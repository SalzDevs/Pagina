import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import type { LayoutOutput } from "../layout/output";
import {
  BULLET_MARKER,
  formatListMarker,
  listItemIndent,
  orderedListStart,
} from "../layout/lists";
import { computeStyles, type StyledNode } from "../style/style";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findList(styled: StyledNode, tag: "ul" | "ol") {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === tag,
  );
}

function itemText(li: StyledNode | undefined, output: LayoutOutput): string {
  if (!li) return "";

  const parts: string[] = [];
  const walk = (node: StyledNode) => {
    for (const fragment of output.getFragments(node)) {
      parts.push(fragment.text);
    }

    for (const child of node.children) {
      if (child.dom.type === "element" && (child.dom.tag === "ul" || child.dom.tag === "ol")) {
        continue;
      }
      walk(child);
    }
  };

  walk(li);
  return parts.join("");
}

function markerX(li: StyledNode | undefined, output: LayoutOutput): number | undefined {
  return output.getFragments(li!)[0]?.x;
}

function itemTexts(list: StyledNode | undefined, output: LayoutOutput): string[] {
  return (
    list?.children
      .filter((child) => child.dom.type === "element" && child.dom.tag === "li")
      .map((item) => itemText(item, output)) ?? []
  );
}

describe("list markers", () => {
  test("formats unordered and ordered markers", () => {
    expect(formatListMarker(false, 1)).toBe(BULLET_MARKER);
    expect(formatListMarker(true, 1)).toBe("1. ");
    expect(formatListMarker(true, 12)).toBe("12. ");
  });

  test("parses ordered list start attribute", async () => {
    const html = '<ol start="5"><li>Item</li></ol>';
    const styled = await computeStyles(convert(parseHTML(html)));
    const list = findList(styled, "ol");
    expect(orderedListStart(list!)).toBe(5);
  });

  test("indents nested list depth", () => {
    expect(listItemIndent(0)).toBe(0);
    expect(listItemIndent(1)).toBe(2);
    expect(listItemIndent(2)).toBe(4);
  });
});

describe("layout lists", () => {
  test("renders unordered list items with bullets", async () => {
    const html = "<ul><li>One</li><li>Two</li></ul>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const list = findList(styled, "ul");
    const texts = itemTexts(list, laidOut.output);

    expect(texts[0]).toBe(`${BULLET_MARKER}One`);
    expect(texts[1]).toBe(`${BULLET_MARKER}Two`);
  });

  test("renders ordered list items with sequential numbers", async () => {
    const html = "<ol><li>First</li><li>Second</li></ol>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const list = findList(styled, "ol");
    const texts = itemTexts(list, laidOut.output);

    expect(texts[0]).toBe("1. First");
    expect(texts[1]).toBe("2. Second");
  });

  test("indents nested unordered lists", async () => {
    const html = "<ul><li>Outer<ul><li>Inner</li></ul></li></ul>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const outer = findList(styled, "ul");
    const outerItem = outer?.children[0];
    const nestedList = outerItem?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "ul",
    );
    const innerItem = nestedList?.children[0];

    expect(markerX(outerItem, laidOut.output)).toBe(0);
    expect(markerX(innerItem, laidOut.output)).toBe(2);
    expect(itemText(innerItem, laidOut.output)).toBe(`${BULLET_MARKER}Inner`);
  });

  test("indents nested ordered lists", async () => {
    const html = "<ol><li>Outer<ol><li>Inner</li></ol></li></ol>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const outer = findList(styled, "ol");
    const outerItem = outer?.children[0];
    const nestedList = outerItem?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "ol",
    );
    const innerItem = nestedList?.children[0];

    expect(markerX(outerItem, laidOut.output)).toBe(0);
    expect(markerX(innerItem, laidOut.output)).toBe(2);
    expect(itemText(innerItem, laidOut.output)).toBe("1. Inner");
  });

  test("lays out examples/lists-page.html with bullets and numbers", async () => {
    const html = await Bun.file("examples/lists-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 60, height: 30 } });

    const lists = findBody(styled)?.children.filter(
      (child) =>
        child.dom.type === "element" && (child.dom.tag === "ul" || child.dom.tag === "ol"),
    );

    expect(lists?.length).toBeGreaterThanOrEqual(3);
    expect(itemTexts(lists?.[0], laidOut.output).some((text) => text.includes(`${BULLET_MARKER}First`))).toBe(true);
    expect(itemTexts(lists?.[1], laidOut.output).some((text) => text.includes("1. Step one"))).toBe(true);

    const nestedOuter = lists?.[2];
    const nestedItem = nestedOuter?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "li" &&
        child.children.some((grandchild) => grandchild.dom.type === "element" && grandchild.dom.tag === "ul"),
    );
    const nested = nestedItem?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "ul",
    );
    const innerLi = nested?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "li",
    );

    expect(itemText(innerLi, laidOut.output)).toBe(`${BULLET_MARKER}Inner A`);
    expect(markerX(innerLi, laidOut.output)).toBe(2);
  });
});
