import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import {
  DEFINITION_INDENT,
  isDefinitionList,
  isDefinitionDescription,
  isDefinitionTerm,
} from "../layout/definitions";
import { layout } from "../layout/layout";
import type { LayoutOutput } from "../layout/output";
import { computeStyles, type StyledNode } from "../style/style";

const viewport = { width: 40, height: 20 };

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findDefinitionList(styled: StyledNode) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "dl",
  );
}

function findTerm(styled: StyledNode, index = 0) {
  return findDefinitionList(styled)?.children.filter((child) => isDefinitionTerm(child))[index];
}

function findDescription(styled: StyledNode, index = 0) {
  return findDefinitionList(styled)?.children.filter((child) => isDefinitionDescription(child))[
    index
  ];
}

function nodeFragments(node: StyledNode | undefined, output: LayoutOutput) {
  if (!node) return [];

  const fragments: ReturnType<LayoutOutput["getFragments"]> = [];
  const walk = (current: StyledNode) => {
    fragments.push(...output.getFragments(current));
    for (const child of current.children) walk(child);
  };
  walk(node);
  return fragments;
}

function lineText(fragments: ReturnType<LayoutOutput["getFragments"]>, y: number) {
  return fragments
    .filter((fragment) => fragment.y === y)
    .sort((left, right) => left.x - right.x)
    .map((fragment) => fragment.text)
    .join("");
}

describe("definition list layout", () => {
  test("detects definition list elements and applies bold UA styles to dt", async () => {
    const html = `
      <dl>
        <dt>Term</dt>
        <dd>Definition</dd>
      </dl>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const dl = findDefinitionList(styled);

    expect(isDefinitionList(dl!)).toBe(true);
    expect(findTerm(styled)?.style.bold).toBe(true);
    expect(findDescription(styled)?.style.bold).toBe(false);
  });

  test("indents dd content relative to dt", async () => {
    const html = `
      <dl>
        <dt>Term</dt>
        <dd>Definition one</dd>
      </dl>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const termFragments = nodeFragments(findTerm(styled), laidOut.output);
    const descriptionFragments = nodeFragments(findDescription(styled), laidOut.output);

    expect(Math.min(...termFragments.map((fragment) => fragment.x))).toBe(0);
    expect(Math.min(...descriptionFragments.map((fragment) => fragment.x))).toBeGreaterThanOrEqual(
      DEFINITION_INDENT,
    );
  });

  test("uses the same indent for multiple dd elements under one dt", async () => {
    const html = `
      <dl>
        <dt>Term</dt>
        <dd>Definition one</dd>
        <dd>Definition two</dd>
      </dl>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const first = nodeFragments(findDescription(styled, 0), laidOut.output);
    const second = nodeFragments(findDescription(styled, 1), laidOut.output);

    expect(first[0]?.x).toBe(second[0]?.x);
    expect(first[0]?.x).toBeGreaterThanOrEqual(DEFINITION_INDENT);
  });

  test("wraps long definitions by word within the reduced width", async () => {
    const html = `<dl><dt>Term</dt><dd>Definition one two three four five six</dd></dl>`;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport: { width: 16, height: 10 } });
    const fragments = nodeFragments(findDescription(styled), laidOut.output);
    const lines = [...new Set(fragments.map((fragment) => fragment.y))].map((y) =>
      lineText(fragments, y),
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ").replace(/\s+/g, " ")).toBe("Definition one two three four five six");
    expect(lines.every((line) => !line.startsWith(" "))).toBe(true);
  });

  test("lays out examples/definitions-page.html with terms and indented descriptions", async () => {
    const html = await Bun.file("examples/definitions-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const termFragments = nodeFragments(findTerm(styled), laidOut.output);
    const descriptionFragments = nodeFragments(findDescription(styled), laidOut.output);
    const descriptionText = descriptionFragments.map((fragment) => fragment.text).join("");

    expect(termFragments.some((fragment) => fragment.text === "Term")).toBe(true);
    expect(descriptionText).toContain("Definition one");
    expect(Math.min(...descriptionFragments.map((fragment) => fragment.x))).toBeGreaterThanOrEqual(
      DEFINITION_INDENT,
    );
  });
});
