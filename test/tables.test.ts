import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import {
  collectCellText,
  collectTableRows,
  isTableElement,
  measureTable,
  TABLE_CELL_GAP,
} from "../layout/tables";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { isTextCommand } from "../paint/display-list";
import type { LayoutOutput } from "../layout/output";
import { computeStyles, type StyledNode } from "../style/style";

const viewport = { width: 40, height: 20 };

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

function findTable(styled: StyledNode) {
  return findBody(styled)?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "table",
  );
}

function findHeaderCell(table: StyledNode | undefined) {
  for (const row of collectTableRows(table!)) {
    const cell = row.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "th",
    );
    if (cell) return cell;
  }
  return undefined;
}

function tableFragments(table: StyledNode | undefined, output: LayoutOutput) {
  if (!table) return [];

  const fragments: ReturnType<LayoutOutput["getFragments"]> = [];
  const walk = (node: StyledNode) => {
    fragments.push(...output.getFragments(node));
    for (const child of node.children) walk(child);
  };
  walk(table);
  return fragments;
}

describe("table layout", () => {
  test("detects table elements and applies bold UA styles to th cells", async () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>1</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled);
    const header = findHeaderCell(table);

    expect(isTableElement(table!)).toBe(true);
    expect(header?.style.bold).toBe(true);
    expect(collectCellText(header!)).toBe("Name");
  });

  test("aligns columns across rows", async () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>1</td></tr>
        <tr><td>Beta</td><td>2</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled);
    const laidOut = layout(styled, { viewport });
    const fragments = tableFragments(table, laidOut.output);

    const byText = new Map(fragments.map((fragment) => [fragment.text, fragment]));
    const nameX = byText.get("Name")?.x;
    const alphaX = byText.get("Alpha")?.x;
    const betaX = byText.get("Beta")?.x;
    const valueX = byText.get("Value")?.x;
    const oneX = byText.get("1")?.x;
    const twoX = byText.get("2")?.x;

    expect(nameX).toBe(alphaX);
    expect(alphaX).toBe(betaX);
    expect(valueX).toBe(oneX);
    expect(oneX).toBe(twoX);
    expect(valueX).toBeGreaterThan(nameX!);
    expect(valueX! - nameX!).toBe(measureTable(table!, viewport.width).columnWidths[0]! + TABLE_CELL_GAP);
  });

  test("sizes columns from the widest cell in each column", async () => {
    const html = `
      <table>
        <tr><td>id</td><td>amount</td></tr>
        <tr><td>10</td><td>1000</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled)!;
    const measured = measureTable(table, 40);

    expect(measured.columnWidths).toEqual([2, 6]);
  });

  test("paints aligned table text commands", async () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>1</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport });
    const painted = paint(styled, laidOut.output);
    const texts = painted.displayList.filter(isTextCommand).map((command) => command.text);

    expect(texts).toContain("Name");
    expect(texts).toContain("Alpha");
    expect(texts).toContain("1");
  });

  test("lays out examples/table-page.html with aligned headers and values", async () => {
    const html = await Bun.file("examples/table-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled);
    const laidOut = layout(styled, { viewport });
    const fragments = tableFragments(table, laidOut.output);
    const byText = new Map(fragments.map((fragment) => [fragment.text, fragment]));

    expect(byText.get("Name")?.x).toBe(byText.get("Alpha")?.x);
    expect(byText.get("Value")?.x).toBe(byText.get("1")?.x);
  });
});
