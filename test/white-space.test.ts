import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { parseInlineStyle } from "../style/css/parse";
import { layout } from "../layout/layout";
import { collectNowrapLines, collectPreformattedText } from "../layout/pre";
import type { LayoutOutput } from "../layout/output";
import { computeStyles, type StyledNode } from "../style/style";

const viewport = { width: 40, height: 10 };

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findByClass(styled: StyledNode, className: string) {
  return findBody(styled)?.children.find(
    (child) =>
      child.dom.type === "element" && child.dom.attributes?.class === className,
  );
}

function textFragments(node: StyledNode | undefined, output: LayoutOutput) {
  if (!node) return [];

  const fragments: typeof output extends LayoutOutput ? ReturnType<LayoutOutput["getFragments"]> : never[] = [];
  const walk = (current: StyledNode) => {
    fragments.push(...output.getFragments(current));
    for (const child of current.children) walk(child);
  };
  walk(node);
  return fragments;
}

describe("white-space CSS parsing", () => {
  test("parses supported white-space keywords", () => {
    expect(parseInlineStyle("white-space: pre").whiteSpace).toBe("pre");
    expect(parseInlineStyle("white-space: pre-wrap").whiteSpace).toBe("pre-wrap");
    expect(parseInlineStyle("white-space: nowrap").whiteSpace).toBe("nowrap");
  });
});

describe("white-space layout", () => {
  test("preserves indentation and line breaks with white-space: pre", async () => {
    const html = `
      <style>p.pre { white-space: pre; }</style>
      <p class="pre">  indented line
      second line</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const paragraph = findByClass(styled, "pre");

    expect(paragraph?.style.whiteSpace).toBe("pre");
    expect(collectPreformattedText(paragraph!)).toBe("  indented line\n      second line");

    const laidOut = layout(styled, { viewport });
    expect(textFragments(paragraph, laidOut.output).map((fragment) => fragment.text)).toEqual([
      "  indented line",
      "      second line",
    ]);
  });

  test("wraps long lines with white-space: pre-wrap", async () => {
    const html = `
      <style>p.pre { white-space: pre-wrap; }</style>
      <p class="pre">  indented ${"word ".repeat(8)}</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const paragraph = findByClass(styled, "pre");
    const laidOut = layout(styled, { viewport: { width: 16, height: 10 } });
    const fragments = textFragments(paragraph, laidOut.output);

    expect(paragraph?.style.whiteSpace).toBe("pre-wrap");
    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments[0]?.text.startsWith("  indented")).toBe(true);
  });

  test("keeps nowrap paragraphs on a single line", async () => {
    const html = `
      <style>p.single { white-space: nowrap; }</style>
      <p class="single">hello   terminal   browser</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const paragraph = findByClass(styled, "single");

    expect(collectNowrapLines(paragraph!)).toEqual(["hello terminal browser"]);

    const laidOut = layout(styled, { viewport: { width: 10, height: 5 } });
    const fragments = textFragments(paragraph, laidOut.output);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.text).toBe("hello terminal browser");
  });

  test("leaves normal paragraphs on the default wrapping path", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));
    const paragraph = findBody(styled)?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "p",
    );

    expect(paragraph?.style.whiteSpace).toBeUndefined();

    const laidOut = layout(styled, { viewport: { width: 10, height: 5 } });
    const fragments =
      paragraph?.children.flatMap((child) => laidOut.output.getFragments(child)) ?? [];

    expect(fragments.length).toBeGreaterThan(1);
  });
});
