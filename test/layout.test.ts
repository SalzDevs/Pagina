import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import type { LayoutOutput } from "../layout/output";
import { computeStyles, type StyledNode } from "../style/style";

function findParagraph(styled: StyledNode) {
  const body = styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
  return body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "p");
}

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findHeading(styled: StyledNode, tag: string) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === tag,
  );
}

function fragmentHeight(node: StyledNode | undefined, output: LayoutOutput): number {
  return node?.children.flatMap((child) => output.getFragments(child))[0]?.height ?? 0;
}

function lineCount(node: StyledNode | undefined, output: LayoutOutput): number {
  const fragments = node?.children.flatMap((child) => output.getFragments(child)) ?? [];
  return new Set(fragments.map((fragment) => fragment.y)).size;
}

function maxLineLength(node: StyledNode | undefined, output: LayoutOutput): number {
  const fragments = node?.children.flatMap((child) => output.getFragments(child)) ?? [];
  const byLine = new Map<number, number>();

  for (const fragment of fragments) {
    byLine.set(fragment.y, (byLine.get(fragment.y) ?? 0) + fragment.text.length);
  }

  return Math.max(0, ...byLine.values());
}

describe("layout", () => {
  test("wraps long lines to the viewport width", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 10, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => laidOut.output.getFragments(child));

    expect((fragments?.length ?? 0) > 1).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("hello"))).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("engine"))).toBe(true);
  });

  test("keeps inline elements on the same line when they fit", async () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => laidOut.output.getFragments(child));

    expect(fragments?.every((fragment) => fragment.y === 0)).toBe(true);
  });

  test("assigns block height from wrapped content", async () => {
    const html = "<p>one two three four five six seven eight nine ten</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 8, height: 10 } });

    const paragraph = findParagraph(styled);
    expect((laidOut.output.getLayout(paragraph!)?.height ?? 0) > 1).toBe(true);
  });

  test("stacks block elements vertically", async () => {
    const html = "<p>first</p><p>second</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const first = body?.children[0];
    const second = body?.children[1];

    expect(
      (laidOut.output.getLayout(first!)?.y ?? 0) < (laidOut.output.getLayout(second!)?.y ?? 0),
    ).toBe(true);
  });

  test("gives headings taller line height than body text", async () => {
    const html = "<h1>Title</h1><h2>Section</h2><p>Body copy</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const h1Height = fragmentHeight(findHeading(styled, "h1"), laidOut.output);
    const h2Height = fragmentHeight(findHeading(styled, "h2"), laidOut.output);
    const bodyHeight = fragmentHeight(findParagraph(styled), laidOut.output);

    expect(h1Height).toBeGreaterThan(h2Height);
    expect(h2Height).toBeGreaterThan(bodyHeight);
    expect(bodyHeight).toBe(1);
  });

  test("applies author font-size to layout height", async () => {
    const html = `
      <style>
        p.lead { font-size: 24px; }
        p.small { font-size: 12px; }
      </style>
      <p class="lead">Large</p>
      <p class="small">Small</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 40, height: 10 } });

    const body = findBody(styled);
    const lead = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "lead",
    );
    const small = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "small",
    );

    expect(fragmentHeight(lead, laidOut.output)).toBe(2);
    expect(fragmentHeight(small, laidOut.output)).toBe(1);
  });

  test("wraps large font-size text before the viewport width", async () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta";
    const html = `<p>${text}</p><h1>${text}</h1>`;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 20, height: 20 } });

    const paragraph = findParagraph(styled);
    const heading = findHeading(styled, "h1");

    expect(lineCount(heading, laidOut.output)).toBeGreaterThan(lineCount(paragraph, laidOut.output));
    expect(maxLineLength(heading, laidOut.output)).toBeLessThan(
      maxLineLength(paragraph, laidOut.output),
    );
  });

  test("wraps author font-size text using scaled line budgets", async () => {
    const text = "one two three four five six seven eight nine ten";
    const html = `
      <style>
        p.large { font-size: 2em; }
      </style>
      <p>${text}</p>
      <p class="large">${text}</p>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));

    const laidOut = layout(styled, { viewport: { width: 16, height: 20 } });
    const body = findBody(styled);
    const normal = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === undefined,
    );
    const large = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "large",
    );

    expect(lineCount(large, laidOut.output)).toBeGreaterThan(lineCount(normal, laidOut.output));
  });
});
