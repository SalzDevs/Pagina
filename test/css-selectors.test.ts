import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { loadPageContent } from "../navigation/load-page";
import { buildPageView } from "../viewport/page-view";
import { parseStylesheet } from "../style/css/parse";
import { computeStyles } from "../style/style";
import { isTextCommand } from "../paint/display-list";
import { NodeType } from "../dom/node";
import { DEFAULT_VIEWPORT } from "./render-compare/fixtures";

function findElementByTag(node: import("../style/style").StyledNode, tag: string): import("../style/style").StyledNode | undefined {
  if (node.dom.type === NodeType.Element && node.dom.tag === tag) return node;
  for (const child of node.children) {
    const found = findElementByTag(child, tag);
    if (found) return found;
  }
  return undefined;
}

describe("link pseudo-class selectors", () => {
  test("parses :link and :visited selectors as tag matches", () => {
    const rules = parseStylesheet("a:link,a:visited{color:#348}");
    expect(rules).toHaveLength(1);
    expect(rules[0]?.selectors).toEqual([
      { kind: "tag", tag: "a" },
      { kind: "tag", tag: "a" },
    ]);
    expect(rules[0]?.declarations.color).toBe("#348");
  });

  test("applies author link color on example.com", async () => {
    const page = await loadPageContent("https://example.com/", {
      viewportWidth: DEFAULT_VIEWPORT.width,
      viewportHeight: DEFAULT_VIEWPORT.height,
    });
    const anchor = findElementByTag(page.styled, "a");

    expect(anchor?.style.fg).toBe("#348");

    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const linkText = view.displayList
      .filter(isTextCommand)
      .find((command) => command.text === "Learn more");
    expect(linkText?.fg).toBe("#58669c");
  });

  test("author link color overrides UA default in cascade", async () => {
    const withoutAuthor = await computeStyles(
      convert(parseHTML(`<html><body><a href="#">More</a></body></html>`)),
    );
    const anchor = findElementByTag(withoutAuthor, "a");
    expect(anchor?.style.fg).toBe("#569cd6");

    const withAuthor = await computeStyles(
      convert(
        parseHTML(
          `<html><head><style>a:link{color:#348}</style></head><body><a href="#">More</a></body></html>`,
        ),
      ),
    );
    const authorAnchor = findElementByTag(withAuthor, "a");
    expect(authorAnchor?.style.fg).toBe("#348");
  });
});
