import { describe, expect, test } from "bun:test";

import { layout } from "../layout/layout";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles, type StyledNode } from "../style/style";

function findParagraph(styled: StyledNode) {
  const body = styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
  return body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "p");
}

describe("LayoutOutput", () => {
  test("does not mutate styled nodes with layout geometry", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>hello</p>")));
    const before = structuredClone(styled);

    layout(styled, { viewport: { width: 40, height: 10 } });

    expect(styled).toEqual(before);
  });

  test("returns independent output on each layout run", async () => {
    const styled = await computeStyles(convert(parseHTML("<p>hello terminal browser</p>")));
    const wide = layout(styled, { viewport: { width: 40, height: 10 } });
    const narrow = layout(styled, { viewport: { width: 10, height: 10 } });

    expect(wide.output).not.toBe(narrow.output);

    const paragraph = findParagraph(styled);
    const wideYs = new Set(
      paragraph?.children.flatMap((child) =>
        wide.output.getFragments(child).map((fragment) => fragment.y),
      ),
    );
    const narrowYs = new Set(
      paragraph?.children.flatMap((child) =>
        narrow.output.getFragments(child).map((fragment) => fragment.y),
      ),
    );

    expect(narrowYs.size).toBeGreaterThan(wideYs.size);
  });
});
