import { describe, expect, test } from "bun:test";

import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { isTextCommand } from "../paint/display-list";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles, type StyledNode } from "../style/style";

const viewport = { width: 80, height: 40 };

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

function headingLineHeight(styled: StyledNode, tag: string, output: ReturnType<typeof layout>["output"]) {
  const heading = findHeading(styled, tag);
  const textNode = heading?.children.find((child) => child.dom.type === "text");
  return output.getFragments(textNode!)[0]?.height ?? 0;
}

describe("heading hierarchy", () => {
  test("assigns distinct line heights to h1, h2, and h3", async () => {
    const html = "<h1>Title</h1><h2>Section</h2><h3>Subsection</h3>";
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });

    const h1Height = headingLineHeight(styled, "h1", laidOut.output);
    const h2Height = headingLineHeight(styled, "h2", laidOut.output);
    const h3Height = headingLineHeight(styled, "h3", laidOut.output);

    expect(h1Height).toBeGreaterThan(h2Height);
    expect(h2Height).toBeGreaterThan(h3Height);
    expect(h3Height).toBeGreaterThan(1);
  });

  test("wraps long heading text without losing hierarchy", async () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu";
    const html = `<h1>${text}</h1><h2>${text}</h2><h3>${text}</h3>`;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport: { width: 24, height: 40 } });

    for (const tag of ["h1", "h2", "h3"] as const) {
      const heading = findHeading(styled, tag);
      const fragments =
        heading?.children.flatMap((child) => laidOut.output.getFragments(child)) ?? [];
      const lines = new Set(fragments.map((fragment) => fragment.y));

      expect(lines.size).toBeGreaterThan(1);
      expect(fragments.every((fragment) => fragment.text.length > 0)).toBe(true);
    }

    expect(headingLineHeight(styled, "h1", laidOut.output)).toBeGreaterThan(
      headingLineHeight(styled, "h2", laidOut.output),
    );
    expect(headingLineHeight(styled, "h2", laidOut.output)).toBeGreaterThan(
      headingLineHeight(styled, "h3", laidOut.output),
    );
  });

  test("paints headings with bold display commands", async () => {
    const html = "<h1>Title</h1><h2>Section</h2>";
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const painted = paint(styled, laidOut.output);
    const headingCommands = painted.displayList.filter(
      (command) => isTextCommand(command) && (command.text === "Title" || command.text === "Section"),
    );

    expect(headingCommands).toHaveLength(2);
    expect(headingCommands.every((command) => command.bold)).toBe(true);
  });

  test("renders long-page.html with distinct h1 and h2 sizes", async () => {
    const html = await Bun.file("examples/long-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });

    expect(headingLineHeight(styled, "h1", laidOut.output)).toBeGreaterThan(
      headingLineHeight(styled, "h2", laidOut.output),
    );
  });
});
