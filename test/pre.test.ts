import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import {
  collectPreformattedText,
  isPreElement,
  layoutPreformattedLines,
} from "../layout/pre";
import type { LayoutFragment } from "../layout/types";
import type { LayoutOutput } from "../layout/output";
import { computeStyles, type StyledNode } from "../style/style";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findPre(styled: StyledNode, index = 0) {
  return findBody(styled)?.children.filter(
    (child) => child.dom.type === "element" && child.dom.tag === "pre",
  )[index];
}

function findParagraph(styled: StyledNode) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "p",
  );
}

function textFragments(node: StyledNode | undefined, output: LayoutOutput): LayoutFragment[] {
  if (!node) return [];

  const fragments: LayoutFragment[] = [];
  const walk = (current: StyledNode) => {
    fragments.push(...output.getFragments(current));
    for (const child of current.children) walk(child);
  };
  walk(node);
  return fragments;
}

describe("preformatted text", () => {
  test("detects pre elements", async () => {
    const styled = await computeStyles(convert(parseHTML("<pre>code</pre>")));
    expect(isPreElement(findPre(styled)!)).toBe(true);
  });

  test("collects pre text without trimming indentation", async () => {
    const html = `<pre>  line one\n    line two</pre>`;
    const styled = await computeStyles(convert(parseHTML(html)));
    expect(collectPreformattedText(findPre(styled)!)).toBe("  line one\n    line two");
  });

  test("preserves indentation and line breaks in layout", async () => {
    const html = `<pre>  alpha\n    beta</pre>`;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const pre = findPre(styled);
    const fragments = textFragments(pre, laidOut.output);
    expect(fragments.map((fragment) => fragment.text)).toEqual(["  alpha", "    beta"]);
    expect(fragments[0]?.y).toBe(0);
    expect(fragments[1]?.y).toBe(1);
  });

  test("does not wrap long pre lines by default", async () => {
    const html = `<pre>${"x".repeat(12)}</pre>`;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 5, height: 10 } });

    const fragments = textFragments(findPre(styled), laidOut.output);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.text).toHaveLength(12);
  });

  test("wraps long lines when white-space is pre-wrap", async () => {
    const html = `<pre style="white-space: pre-wrap">${"x".repeat(12)}</pre>`;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 5, height: 10 } });

    const fragments = textFragments(findPre(styled), laidOut.output);
    expect(fragments.map((fragment) => fragment.text)).toEqual(["xxxxx", "xxxxx", "xx"]);
  });

  test("keeps normal paragraphs wrapping separately", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 10, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments =
      paragraph?.children.flatMap((child) => laidOut.output.getFragments(child)) ?? [];
    expect(fragments.length).toBeGreaterThan(1);
  });

  test("lays out examples/pre-page.html with code and ascii art", async () => {
    const html = await Bun.file("examples/pre-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 20 } });

    const codePre = findPre(styled, 0);
    const artPre = findPre(styled, 1);
    const codeText = textFragments(codePre, laidOut.output).map((fragment) => fragment.text).join("\n");

    expect(codeText).toContain('function greet(name) {');
    expect(codeText).toContain('  return "hello " + name;');
    expect(textFragments(artPre, laidOut.output).some((fragment) => fragment.text.trim() === "*")).toBe(true);
  });
});

describe("layoutPreformattedLines", () => {
  test("emits one row per empty line", () => {
    const fragments: LayoutFragment[] = [];
    const target = {
      dom: { type: "text" as const, value: "" },
      style: { display: "inline" as const, bold: false, italic: false, underline: false },
      children: [],
    };

    const endY = layoutPreformattedLines(
      target,
      "a\n\nb",
      0,
      0,
      10,
      1,
      (_node, fragment) => fragments.push(fragment),
    );

    expect(endY).toBe(3);
    expect(fragments.map((fragment) => fragment.text)).toEqual(["a", "b"]);
    expect(fragments[1]?.y).toBe(2);
  });
});
