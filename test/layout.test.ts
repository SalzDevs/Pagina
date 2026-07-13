import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
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

function fragmentHeight(node: StyledNode | undefined): number {
  return node?.children.flatMap((child) => child.fragments ?? [])[0]?.height ?? 0;
}

describe("layout", () => {
  test("wraps long lines to the viewport width", async () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 10, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => child.fragments ?? []);

    expect((fragments?.length ?? 0) > 1).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("hello"))).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("engine"))).toBe(true);
  });

  test("keeps inline elements on the same line when they fit", async () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => child.fragments ?? []);

    expect(fragments?.every((fragment) => fragment.y === 0)).toBe(true);
  });

  test("assigns block height from wrapped content", async () => {
    const html = "<p>one two three four five six seven eight nine ten</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 8, height: 10 } });

    const paragraph = findParagraph(styled);
    expect((paragraph?.layout?.height ?? 0) > 1).toBe(true);
  });

  test("stacks block elements vertically", async () => {
    const html = "<p>first</p><p>second</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 10 } });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const first = body?.children[0];
    const second = body?.children[1];

    expect((first?.layout?.y ?? 0) < (second?.layout?.y ?? 0)).toBe(true);
  });

  test("gives headings taller line height than body text", async () => {
    const html = "<h1>Title</h1><h2>Section</h2><p>Body copy</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 10 } });

    const h1Height = fragmentHeight(findHeading(styled, "h1"));
    const h2Height = fragmentHeight(findHeading(styled, "h2"));
    const bodyHeight = fragmentHeight(findParagraph(styled));

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

    layout(styled, { viewport: { width: 40, height: 10 } });

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

    expect(fragmentHeight(lead)).toBe(2);
    expect(fragmentHeight(small)).toBe(1);
  });
});
