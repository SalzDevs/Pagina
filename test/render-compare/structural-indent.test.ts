import { describe, expect, test } from "bun:test";

import { LIST_INDENT } from "../../layout/lists";
import { DEFINITION_INDENT } from "../../layout/definitions";
import { BLOCKQUOTE_INDENT } from "../../style/style";
import {
  buildStructuralLayout,
  collectLayoutFragments,
  expectIncreasingLayoutX,
  expectLayoutX,
  findLayoutFragment,
  formatStructuralOffsets,
} from "./structural-indent";

describe("render comparison — structural indent", () => {
  test("lists-page.html indents nested list markers and text by depth", async () => {
    const { styled, output } = await buildStructuralLayout("examples/lists-page.html");
    const fragments = collectLayoutFragments(output, styled);

    const outerMarker = fragments.find((fragment) => fragment.text.trim() === "-" && fragment.x === 0);
    const innerMarker = fragments.find(
      (fragment) => fragment.text.trim() === "-" && fragment.x === LIST_INDENT,
    );
    const outerItem = findLayoutFragment(fragments, (text) => text === "Outer one");
    const innerItem = findLayoutFragment(fragments, (text) => text === "Inner A");

    expectLayoutX(outerMarker, 0, "depth-0 bullet marker");
    expectLayoutX(outerItem, 0, "depth-0 list text");
    expectLayoutX(innerMarker, LIST_INDENT, "depth-1 bullet marker");
    expectLayoutX(innerItem, LIST_INDENT, "depth-1 list text");

    expectIncreasingLayoutX([
      { label: "Outer one", fragment: outerItem },
      { label: "Inner A", fragment: innerItem },
    ]);

    expect(formatStructuralOffsets([
      { label: "outer marker", fragment: outerMarker },
      { label: "inner marker", fragment: innerMarker },
      { label: "inner item", fragment: innerItem },
    ])).toContain("inner marker: x=2");
  });

  test("blockquote-page.html increases blockquote indent per nesting level", async () => {
    const { styled, output } = await buildStructuralLayout("examples/blockquote-page.html");
    const fragments = collectLayoutFragments(output, styled);

    const body = findLayoutFragment(fragments, (text) => text.includes("Body text sits"));
    const singleQuote = findLayoutFragment(fragments, (text) =>
      text.includes("This quotation is indented"),
    );
    const outerQuote = findLayoutFragment(fragments, (text) => text.includes("Outer quote"));
    const nestedQuote = findLayoutFragment(fragments, (text) =>
      text.includes("Nested quote indents further"),
    );

    expectLayoutX(body, 0, "body text");
    expectLayoutX(singleQuote, BLOCKQUOTE_INDENT, "single blockquote");
    expectLayoutX(outerQuote, BLOCKQUOTE_INDENT, "outer nested blockquote");
    expectLayoutX(nestedQuote, BLOCKQUOTE_INDENT * 2, "double-nested blockquote");

    expectIncreasingLayoutX([
      { label: "body text", fragment: body },
      { label: "outer quote", fragment: outerQuote },
      { label: "nested quote", fragment: nestedQuote },
    ]);
  });

  test("definitions-page.html indents descriptions but keeps terms flush left", async () => {
    const { styled, output } = await buildStructuralLayout("examples/definitions-page.html");
    const fragments = collectLayoutFragments(output, styled);

    const term = findLayoutFragment(fragments, (text) => text === "Term");
    const definitionOne = findLayoutFragment(fragments, (text) =>
      text.includes("Definition one with enough words"),
    );
    const definitionTwo = findLayoutFragment(fragments, (text) => text === "Definition two");
    const anotherTerm = findLayoutFragment(fragments, (text) => text === "Another term");

    expectLayoutX(term, 0, "definition term");
    expectLayoutX(anotherTerm, 0, "second definition term");
    expectLayoutX(definitionOne, DEFINITION_INDENT, "first definition");
    expectLayoutX(definitionTwo, DEFINITION_INDENT, "second definition");

    expectIncreasingLayoutX([
      { label: "Term", fragment: term },
      { label: "Definition one", fragment: definitionOne },
    ]);
    expect(definitionOne!.y).toBeLessThan(anotherTerm!.y);
  });

  test("table-page.html aligns cells in shared columns", async () => {
    const { styled, output } = await buildStructuralLayout("examples/table-page.html");
    const fragments = collectLayoutFragments(output, styled);

    const nameHeader = findLayoutFragment(fragments, (text) => text === "Name");
    const valueHeader = findLayoutFragment(fragments, (text) => text === "Value");
    const alphaCell = findLayoutFragment(fragments, (text) => text === "Alpha");
    const oneCell = findLayoutFragment(fragments, (text) => text === "1");
    const betaCell = findLayoutFragment(fragments, (text) => text === "Beta");
    const twoCell = findLayoutFragment(fragments, (text) => text === "2");

    expectLayoutX(nameHeader, 0, "Name header");
    expectLayoutX(alphaCell, 0, "Alpha cell");
    expectLayoutX(betaCell, 0, "Beta cell");
    expectLayoutX(valueHeader, 7, "Value header");
    expectLayoutX(oneCell, 7, "1 cell");
    expectLayoutX(twoCell, 7, "2 cell");

    expectIncreasingLayoutX([
      { label: "Name column", fragment: nameHeader },
      { label: "Value column", fragment: valueHeader },
    ]);

    expect(nameHeader!.x).toBe(alphaCell!.x);
    expect(valueHeader!.x).toBe(oneCell!.x);
    expect(alphaCell!.x).toBeLessThan(valueHeader!.x);
  });

  test("reports readable structural offsets when expectations fail", () => {
    const formatted = formatStructuralOffsets([
      { label: "outer", fragment: { x: 0, y: 1, text: "Outer one" } },
      { label: "inner", fragment: { x: 2, y: 2, text: "Inner A" } },
    ]);

    expect(formatted).toBe(
      'outer: x=0 y=1 text="Outer one"\ninner: x=2 y=2 text="Inner A"',
    );
  });
});
