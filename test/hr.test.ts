import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { formatHrLine, HR_CHARACTER, isHrElement } from "../layout/hr";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { HR_VERTICAL_MARGIN, computeStyles, type StyledNode } from "../style/style";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findByTag(styled: StyledNode, tag: string, index = 0) {
  return findBody(styled)?.children.filter(
    (child) => child.dom.type === "element" && child.dom.tag === tag,
  )[index];
}

function findDiv(styled: StyledNode) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "div",
  );
}

function findHrIn(node: StyledNode | undefined): StyledNode | undefined {
  if (!node) return undefined;

  if (isHrElement(node)) return node;

  for (const child of node.children) {
    const found = findHrIn(child);
    if (found) return found;
  }

  return undefined;
}

describe("horizontal rules", () => {
  test("detects hr elements", async () => {
    const styled = await computeStyles(convert(parseHTML("<hr>")));
    expect(isHrElement(findByTag(styled, "hr")!)).toBe(true);
  });

  test("formats a rule line to the content width", () => {
    expect(formatHrLine(5)).toBe("─────");
    expect(formatHrLine(1)).toBe(HR_CHARACTER);
  });

  test("applies UA vertical margin and dim foreground", async () => {
    const styled = await computeStyles(convert(parseHTML("<hr>")));
    const hr = findByTag(styled, "hr");

    expect(hr?.style.marginTop).toBe(HR_VERTICAL_MARGIN);
    expect(hr?.style.marginBottom).toBe(HR_VERTICAL_MARGIN);
    expect(hr?.style.fg).toBe("#666666");
  });

  test("renders a visible rule between sections", async () => {
    const html = "<p>Section one</p><hr><p>Section two</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 20, height: 10 } });

    const hr = findByTag(styled, "hr");
    const fragment = laidOut.output.getFragments(hr!)[0];

    expect(fragment?.text).toBe(formatHrLine(20));
    expect(fragment?.width).toBe(20);
    expect(
      (laidOut.output.getLayout(findByTag(styled, "p", 0)!)?.y ?? 0) <
        (laidOut.output.getLayout(hr!)?.y ?? 0),
    ).toBe(true);
    expect(
      (laidOut.output.getLayout(hr!)?.y ?? 0) <
        (laidOut.output.getLayout(findByTag(styled, "p", 1)!)?.y ?? 0),
    ).toBe(true);
  });

  test("respects horizontal inset inside padded containers", async () => {
    const html = `
      <div style="padding-left: 3; padding-right: 2;">
        <hr>
      </div>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 20, height: 10 } });

    const hr = findHrIn(findDiv(styled));
    const fragment = laidOut.output.getFragments(hr!)[0];

    expect(fragment?.x).toBe(3);
    expect(fragment?.text).toBe(formatHrLine(15));
  });

  test("paints hr fragments as text commands", async () => {
    const html = "<hr>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 12, height: 5 } });
    const displayList = paint(styled, laidOut.output).displayList;
    const hrText = displayList.find(
      (command) => command.kind === "text" && command.text.includes(HR_CHARACTER),
    );

    expect(hrText).toEqual({
      kind: "text",
      x: 0,
      y: 1,
      text: formatHrLine(12),
      fg: "#666666",
      bg: undefined,
      bold: undefined,
      italic: undefined,
      underline: undefined,
    });
  });

  test("lays out examples/hr-page.html with full-width and inset rules", async () => {
    const html = await Bun.file("examples/hr-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 30, height: 20 } });

    const topHr = findByTag(styled, "hr");
    const insetHr = findHrIn(findDiv(styled));

    expect(laidOut.output.getFragments(topHr!)[0]?.text).toBe(formatHrLine(30));
    expect(laidOut.output.getFragments(insetHr!)[0]?.x).toBe(4);
    expect(laidOut.output.getFragments(insetHr!)[0]?.text.length).toBe(26);
  });
});
