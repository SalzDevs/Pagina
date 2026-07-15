import { describe, expect, test } from "bun:test";

import {
  IMAGE_FALLBACK_PLACEHOLDER,
  imagePlaceholderText,
  isImgElement,
} from "../layout/img";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { isTextCommand } from "../paint/display-list";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { IMG_PLACEHOLDER_FG, computeStyles, type StyledNode } from "../style/style";

const viewport = { width: 80, height: 24 };

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findParagraph(styled: StyledNode, index = 0) {
  return findBody(styled)?.children.filter(
    (child) => child.dom.type === "element" && child.dom.tag === "p",
  )[index];
}

function findImg(node: StyledNode | undefined): StyledNode | undefined {
  if (!node) return undefined;
  if (isImgElement(node)) return node;

  for (const child of node.children) {
    const found = findImg(child);
    if (found) return found;
  }

  return undefined;
}

describe("image placeholders", () => {
  test("formats alt text and fallback tokens", () => {
    const withAlt = {
      dom: { type: "element" as const, tag: "img", attributes: { alt: "sales chart" } },
      style: { display: "inline" as const, bold: false, italic: false, underline: false },
      children: [],
    };
    const withoutAlt = {
      dom: { type: "element" as const, tag: "img", attributes: {} },
      style: { display: "inline" as const, bold: false, italic: false, underline: false },
      children: [],
    };

    expect(isImgElement(withAlt)).toBe(true);
    expect(imagePlaceholderText(withAlt)).toBe("[alt: sales chart]");
    expect(imagePlaceholderText(withoutAlt)).toBe(IMAGE_FALLBACK_PLACEHOLDER);
  });

  test("applies dim italic UA styles to img elements", async () => {
    const styled = await computeStyles(
      convert(parseHTML('<p><img src="x.png" alt="diagram"></p>')),
    );
    const img = findImg(findParagraph(styled));

    expect(img?.style.italic).toBe(true);
    expect(img?.style.fg).toBe(IMG_PLACEHOLDER_FG);
  });

  test("lays out inline image placeholders inside paragraphs", async () => {
    const html = '<p>See the <img src="chart.png" alt="sales chart"> for details.</p>';
    const styled = await computeStyles(convert(parseHTML(html)));
    const paragraph = findParagraph(styled);
    const laidOut = layout(styled, { viewport });
    const img = findImg(paragraph);
    const fragments = paragraph?.children.flatMap((child) => laidOut.output.getFragments(child)) ?? [];
    const text = fragments.map((fragment) => fragment.text).join("");

    expect(text).toContain("See the");
    expect(text).toContain("[alt: sales chart]");
    expect(text).toContain("for details.");
    expect(laidOut.output.getFragments(img!)).toEqual([
      expect.objectContaining({ text: "[alt: sales chart]" }),
    ]);
  });

  test("lays out block-level images as their own placeholder line", async () => {
    const html = '<img src="hero.jpg" alt="hero banner" style="display: block">';
    const styled = await computeStyles(convert(parseHTML(html)));
    const img = findBody(styled)?.children.find((child) => isImgElement(child));
    const laidOut = layout(styled, { viewport });
    const fragments = laidOut.output.getFragments(img!);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.text).toBe("[alt: hero banner]");
  });

  test("paints placeholder text commands for images", async () => {
    const html = '<p>Before <img src="icon.png"> after</p>';
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const painted = paint(styled, laidOut.output);
    const textCommands = painted.displayList.filter(isTextCommand).map((command) => command.text);
    const combined = textCommands.join("");

    expect(combined).toContain("[image]");
    expect(combined).toContain("Before");
    expect(combined).toContain("after");
    expect(textCommands.filter((text) => text.includes("[image]"))).toEqual(["[image]"]);
  });
});
