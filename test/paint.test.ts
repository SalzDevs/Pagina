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

    layout(styled, { viewport });
    const displayList = paint(styled);

    expect(displayList.length).toBeGreaterThan(0);
    expect(displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("Hello"))).toBe(true);
    expect(displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("world"))).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.x === "number")).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.y === "number")).toBe(true);
  });

  test("uses layout positions for each command", async () => {
    const html = "<p>ab</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport });
    const displayList = paint(styled);
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

    layout(styled, { viewport });
    const displayList = paint(styled);

    expect(
      displayList.some((cmd) => isTextCommand(cmd) && cmd.text.includes("bold") && cmd.bold),
    ).toBe(true);
  });

  test("paints block backgrounds as fill commands", async () => {
    const html = await Bun.file("examples/styled-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)), {
      pageLocation: "examples/styled-page.html",
    });

    layout(styled, { viewport });
    const displayList = paint(styled, { viewportHeight: viewport.height });
    const bodyFill = displayList.find(
      (command) => isFillCommand(command) && command.bg === "#111111",
    );

    expect(bodyFill).toBeDefined();
    expect(bodyFill?.width).toBe(80);
    expect(bodyFill?.height).toBeGreaterThanOrEqual(24);
    expect(displayList.some((command) => isTextCommand(command))).toBe(true);
  });

  test("places fill commands before text commands", async () => {
    const html = `
      <style>
        body { background: #111111; color: #cccccc; }
      </style>
      <p>hello</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport });
    const displayList = paint(styled, { viewportHeight: viewport.height });

    expect(isFillCommand(displayList[0]!)).toBe(true);
    expect(displayList.some((command) => isTextCommand(command) && command.text.includes("hello"))).toBe(
      true,
    );
  });
});
