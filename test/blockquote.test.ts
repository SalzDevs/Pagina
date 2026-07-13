import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import type { LayoutOutput } from "../layout/output";
import { BLOCKQUOTE_INDENT, computeStyles, type StyledNode } from "../style/style";

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

function findNestedBlockquote(outer: StyledNode | undefined) {
  const walk = (node: StyledNode): StyledNode | undefined => {
    for (const child of node?.children ?? []) {
      if (child.dom.type === "element" && child.dom.tag === "blockquote") {
        return child;
      }
      const nested = walk(child);
      if (nested) return nested;
    }
    return undefined;
  };

  return walk(outer!);
}

function textFragments(
  node: StyledNode | undefined,
  output: LayoutOutput,
): Array<{ x: number; text: string }> {
  if (!node) return [];

  const fragments: Array<{ x: number; text: string }> = [];
  const walk = (current: StyledNode) => {
    for (const fragment of output.getFragments(current)) {
      fragments.push({ x: fragment.x, text: fragment.text });
    }
    for (const child of current.children) walk(child);
  };
  walk(node);
  return fragments;
}

describe("blockquote UA styles", () => {
  test("applies default left margin to blockquote elements", async () => {
    const styled = await computeStyles(convert(parseHTML("<blockquote>Quote</blockquote>")));
    const quote = findByTag(styled, "blockquote");

    expect(quote?.style.marginLeft).toBe(BLOCKQUOTE_INDENT);
  });

  test("lets author margin-left override the UA default", async () => {
    const html = `
      <style>blockquote { margin-left: 2; }</style>
      <blockquote>Quote</blockquote>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const quote = findByTag(styled, "blockquote");

    expect(quote?.style.marginLeft).toBe(2);
  });
});

describe("blockquote layout", () => {
  test("indents unstyled blockquote content right of body text", async () => {
    const html = `
      <p>Before</p>
      <blockquote>Quoted text</blockquote>
      <p>After</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const paragraph = findByTag(styled, "p");
    const quote = findByTag(styled, "blockquote");
    const bodyFragments = textFragments(paragraph, laidOut.output);
    const quoteFragments = textFragments(quote, laidOut.output);

    expect(bodyFragments[0]?.x).toBe(0);
    expect(laidOut.output.getLayout(quote!)?.x).toBe(BLOCKQUOTE_INDENT);
    expect(quoteFragments[0]?.x).toBe(BLOCKQUOTE_INDENT);
    expect(quoteFragments.some((fragment) => fragment.text.includes("Quoted"))).toBe(true);
  });

  test("indents nested blockquotes further", async () => {
    const html = `
      <blockquote>
        Outer
        <blockquote>Inner</blockquote>
      </blockquote>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const outer = findByTag(styled, "blockquote");
    const inner = findNestedBlockquote(outer);

    expect(outer?.style.marginLeft).toBe(BLOCKQUOTE_INDENT);
    expect(inner?.style.marginLeft).toBe(BLOCKQUOTE_INDENT);
    expect(textFragments(inner, laidOut.output)[0]?.x).toBe(BLOCKQUOTE_INDENT * 2);
  });

  test("lays out examples/blockquote-page.html with default and nested quotes", async () => {
    const html = await Bun.file("examples/blockquote-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 50, height: 20 } });

    const quotes = findBody(styled)?.children.filter(
      (child) => child.dom.type === "element" && child.dom.tag === "blockquote",
    );

    expect((quotes?.length ?? 0) >= 2).toBe(true);
    expect(textFragments(quotes?.[0], laidOut.output).some((fragment) => fragment.x === BLOCKQUOTE_INDENT)).toBe(
      true,
    );

    const nested = findNestedBlockquote(quotes?.[1]);
    expect(textFragments(nested, laidOut.output).some((fragment) => fragment.x === BLOCKQUOTE_INDENT * 2)).toBe(
      true,
    );
  });
});
