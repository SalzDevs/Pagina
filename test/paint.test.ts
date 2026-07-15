import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { isFillCommand, isTextCommand } from "../paint/display-list";
import { computeStyles } from "../style/style";

const viewport = { width: 80, height: 24 };

describe("paint", () => {
  test("emits display commands from laid-out text nodes", async () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output).displayList;

    expect(displayList.length).toBeGreaterThan(0);
    expect(displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("Hello"))).toBe(true);
    expect(displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("world"))).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.x === "number")).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.y === "number")).toBe(true);
  });

  test("uses layout positions for each command", async () => {
    const html = "<p>ab</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output).displayList;
    const firstText = displayList.find(isTextCommand);

    expect(firstText).toEqual({
      kind: "text",
      x: 0,
      y: 0,
      text: "ab",
      bold: undefined,
      italic: undefined,
      underline: undefined,
    });
  });

  test("applies computed styles to display commands", async () => {
    const html = "<p><strong>bold</strong></p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output).displayList;

    expect(
      displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("bold") && cmd.bold),
    ).toBe(true);
  });

  test("paints inline code with a background color", async () => {
    const html = "<p>Run <code>bun start</code> to launch.</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output).displayList;
    const codeText = displayList.find(
      (cmd) => isTextCommand(cmd) && cmd.text === "bun start",
    );

    expect(codeText?.fg).toBe("#ce9178");
    expect(codeText?.bg).toBe("#2a2a2a");
  });

  test("paints block backgrounds as fill commands", async () => {
    const html = await Bun.file("examples/styled-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)), {
      pageLocation: "examples/styled-page.html",
    });

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output, { viewportHeight: viewport.height }).displayList;
    const bodyFill = displayList.find(
      (command) => isFillCommand(command) && command.bg === "#111111",
    );

    expect(bodyFill).toBeDefined();
    expect(bodyFill?.width).toBe(80);
    expect(bodyFill?.height).toBeGreaterThanOrEqual(24);
    expect(displayList.some((command) => isTextCommand(command))).toBe(true);
  });

  test("paints list markers and item text", async () => {
    const html = "<ul><li>One</li><li>Two</li></ul>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output).displayList;
    const text = displayList
      .filter(isTextCommand)
      .map((command) => command.text)
      .join("");

    expect(text).toContain("One");
    expect(text).toContain("Two");
    expect(text).toContain("- ");
  });

  test("paints list item text from examples/lists-page.html", async () => {
    const html = await Bun.file("examples/lists-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 60, height: 30 } });
    const displayList = paint(styled, laidOut.output).displayList;
    const text = displayList
      .filter(isTextCommand)
      .map((command) => command.text)
      .join("");

    expect(text).toContain("First item");
    expect(text).toContain("Step one");
    expect(text).toContain("Inner A");
  });

  test("places fill commands before text commands", async () => {
    const html = `
      <style>
        body { background: #111111; color: #cccccc; }
      </style>
      <p>hello</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport });
    const displayList = paint(styled, laidOut.output, { viewportHeight: viewport.height }).displayList;

    expect(isFillCommand(displayList[0]!)).toBe(true);
    expect(displayList.some((command) => isTextCommand(command) && command.text.includes("hello"))).toBe(
      true,
    );
  });

  test("extends body background fills through full content height", async () => {
    const paragraphs = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index}</p>`).join("");
    const html = `
      <style>
        body { background: #111111; color: #cccccc; }
      </style>
      <h1>Long styled page</h1>
      ${paragraphs}
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const painted = paint(styled, laidOut.output, { viewportHeight: viewport.height });
    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const bodyFill = painted.displayList
      .filter(isFillCommand)
      .find(
        (command) =>
          command.bg === "#111111" &&
          command.x === 0 &&
          command.y === 0 &&
          command.width === viewport.width,
      );

    expect(bodyFill).toBeDefined();
    expect(bodyFill!.height).toBeGreaterThanOrEqual(painted.contentHeight);
    expect(bodyFill!.height).toBeGreaterThan(viewport.height);
  });

  test("keeps linked-page body background across tall content", async () => {
    const paragraphs = Array.from({ length: 40 }, (_, index) => `<p>Paragraph ${index}</p>`).join("");
    const html = await Bun.file("examples/linked-page.html").text();
    const longHtml = html.replace("</body>", `${paragraphs}</body>`);
    const styled = await computeStyles(convert(parseHTML(longHtml)), {
      pageLocation: "examples/linked-page.html",
      documentBase: `${process.cwd()}/examples`,
    });
    const laidOut = layout(styled, { viewport });
    const painted = paint(styled, laidOut.output, { viewportHeight: viewport.height });
    const bodyFill = painted.displayList
      .filter(isFillCommand)
      .find(
        (command) =>
          command.bg === "#111111" &&
          command.x === 0 &&
          command.y === 0 &&
          command.width === viewport.width,
      );

    expect(bodyFill).toBeDefined();
    expect(bodyFill!.height).toBeGreaterThanOrEqual(painted.contentHeight);
  });
});
