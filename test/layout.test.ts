import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { computeStyles } from "../style/style";

function findParagraph(styled: ReturnType<typeof computeStyles>) {
  const body = styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
  return body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "p");
}

describe("layout", () => {
  test("wraps long lines to the viewport width", () => {
    const html = "<p>hello terminal browser engine</p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 10, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => child.fragments ?? []);

    expect((fragments?.length ?? 0) > 1).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("hello"))).toBe(true);
    expect(fragments?.some((fragment) => fragment.text.includes("engine"))).toBe(true);
  });

  test("keeps inline elements on the same line when they fit", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 5 } });

    const paragraph = findParagraph(styled);
    const fragments = paragraph?.children.flatMap((child) => child.fragments ?? []);

    expect(fragments?.every((fragment) => fragment.y === 0)).toBe(true);
  });

  test("assigns block height from wrapped content", () => {
    const html = "<p>one two three four five six seven eight nine ten</p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 8, height: 10 } });

    const paragraph = findParagraph(styled);
    expect((paragraph?.layout?.height ?? 0) > 1).toBe(true);
  });

  test("stacks block elements vertically", () => {
    const html = "<p>first</p><p>second</p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport: { width: 40, height: 10 } });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const first = body?.children[0];
    const second = body?.children[1];

    expect((first?.layout?.y ?? 0) < (second?.layout?.y ?? 0)).toBe(true);
  });
});
