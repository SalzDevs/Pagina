import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { blockBox } from "../layout/box";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { parseStylesheet } from "../style/css/parse";
import { computeStyles, type StyledNode } from "../style/style";
import type { FillCommand } from "../paint/display-list";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findByTag(styled: StyledNode, tag: string) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === tag,
  );
}

function findByClass(styled: StyledNode, className: string) {
  return findBody(styled)?.children.find(
    (child) =>
      child.dom.type === "element" &&
      child.dom.attributes?.class === className,
  );
}

function textFragments(node: StyledNode | undefined): Array<{ x: number; text: string }> {
  if (!node) return [];

  const fragments: Array<{ x: number; text: string }> = [];
  const walk = (current: StyledNode) => {
    for (const fragment of current.fragments ?? []) {
      fragments.push({ x: fragment.x, text: fragment.text });
    }
    for (const child of current.children) walk(child);
  };
  walk(node);
  return fragments;
}

function isFillCommand(cmd: unknown): cmd is FillCommand {
  return typeof cmd === "object" && cmd !== null && (cmd as FillCommand).kind === "fill";
}

describe("horizontal spacing parse", () => {
  test("parses horizontal margin and padding properties", () => {
    const rules = parseStylesheet("p { margin-left: 4; padding-right: 2; }");
    expect(rules[0]?.declarations.marginLeft).toBe(4);
    expect(rules[0]?.declarations.paddingRight).toBe(2);
  });

  test("parses four-value margin and padding shorthands", () => {
    const margin = parseStylesheet("p { margin: 1 2 3 4; }")[0]?.declarations;
    expect(margin?.marginTop).toBe(1);
    expect(margin?.marginRight).toBe(2);
    expect(margin?.marginBottom).toBe(3);
    expect(margin?.marginLeft).toBe(4);

    const padding = parseStylesheet("p { padding: 4 3 2 1; }")[0]?.declarations;
    expect(padding?.paddingTop).toBe(4);
    expect(padding?.paddingRight).toBe(3);
    expect(padding?.paddingBottom).toBe(2);
    expect(padding?.paddingLeft).toBe(1);
  });

  test("parses two-value shorthands as vertical then horizontal", () => {
    const rules = parseStylesheet("p { margin: 2 5; padding: 1 3; }");
    expect(rules[0]?.declarations.marginTop).toBe(2);
    expect(rules[0]?.declarations.marginBottom).toBe(2);
    expect(rules[0]?.declarations.marginLeft).toBe(5);
    expect(rules[0]?.declarations.marginRight).toBe(5);
    expect(rules[0]?.declarations.paddingTop).toBe(1);
    expect(rules[0]?.declarations.paddingBottom).toBe(1);
    expect(rules[0]?.declarations.paddingLeft).toBe(3);
    expect(rules[0]?.declarations.paddingRight).toBe(3);
  });
});

describe("blockBox", () => {
  test("computes content inset from margin and padding", () => {
    const box = blockBox(
      {
        display: "block",
        bold: false,
        italic: false,
        underline: false,
        marginLeft: 4,
        marginRight: 2,
        paddingLeft: 2,
        paddingRight: 1,
      },
      0,
      40,
    );

    expect(box).toEqual({
      layoutX: 4,
      layoutWidth: 34,
      contentX: 6,
      contentWidth: 31,
    });
  });
});

describe("horizontal inset layout", () => {
  test("shifts block content right with left margin", async () => {
    const html = `
      <style>blockquote { margin-left: 4ch; }</style>
      <blockquote>Quoted text</blockquote>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 10 } });

    const quote = findByTag(styled, "blockquote");
    const fragments = textFragments(quote);

    expect(quote?.layout?.x).toBe(4);
    expect(fragments[0]?.x).toBe(4);
    expect(fragments.some((fragment) => fragment.text.includes("Quoted"))).toBe(true);
  });

  test("wraps text inside reduced content width from horizontal padding", async () => {
    const html = `
      <style>p { padding-left: 2; padding-right: 2; }</style>
      <p>hello terminal browser engine</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 12, height: 10 } });

    const paragraph = findByTag(styled, "p");
    const fragments = textFragments(paragraph);

    expect(paragraph?.layout?.x).toBe(0);
    expect(paragraph?.layout?.width).toBe(12);
    expect(fragments.every((fragment) => fragment.x >= 2)).toBe(true);
    expect(fragments.length).toBeGreaterThan(1);
  });

  test("paints block backgrounds on the inset padding box", async () => {
    const html = `
      <style>blockquote { margin-left: 3; background-color: #333; }</style>
      <blockquote>Quote</blockquote>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 30, height: 10 } });
    const displayList = paint(styled);
    const quote = findByTag(styled, "blockquote");
    const fill = displayList.find(isFillCommand);

    expect(fill?.x).toBe(3);
    expect(fill?.width).toBe(quote?.layout?.width);
    expect(fill?.bg).toBe("#333");
  });

  test("lays out examples/inset-page.html with blockquote and narrow paragraph", async () => {
    const html = await Bun.file("examples/inset-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 20 } });

    const quote = findByTag(styled, "blockquote");
    const narrow = findByClass(styled, "narrow");

    expect((quote?.layout?.x ?? 0) >= 4).toBe(true);
    expect(textFragments(quote)[0]?.x).toBeGreaterThanOrEqual(6);
    expect((narrow?.layout?.width ?? 40) < 40).toBe(true);
    expect(textFragments(narrow).every((fragment) => fragment.x >= 2)).toBe(true);
  });
});
