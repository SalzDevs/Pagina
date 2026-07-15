import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import {
  collectCellText,
  collectTableRows,
  formatTableCellText,
  formatTableHeaderRule,
  isTableElement,
  measureTable,
  shrinkColumnWidthsToFit,
  TABLE_CELL_GAP,
  TABLE_ELLIPSIS,
  truncateTableCellText,
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

function fragmentForCellText(
  fragments: ReturnType<typeof tableFragments>,
  text: string,
) {
  return fragments.find((fragment) => fragment.text.trim() === text);
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

    const nameX = fragmentForCellText(fragments, "Name")?.x;
    const alphaX = fragmentForCellText(fragments, "Alpha")?.x;
    const betaX = fragmentForCellText(fragments, "Beta")?.x;
    const valueX = fragmentForCellText(fragments, "Value")?.x;
    const oneX = fragmentForCellText(fragments, "1")?.x;
    const twoX = fragmentForCellText(fragments, "2")?.x;

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

  test("formats a header underline aligned to column widths", () => {
    expect(formatTableHeaderRule([4, 5], TABLE_CELL_GAP)).toBe("────  ─────");
  });

  test("draws a header underline after the first header row", async () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>Alpha</td><td>1</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled)!;
    const laidOut = layout(styled, { viewport });
    const measured = measureTable(table, viewport.width);
    const expectedRule = formatTableHeaderRule(measured.columnWidths, TABLE_CELL_GAP);
    const tableRule = laidOut.output.getFragments(table);
    const fragments = tableFragments(table, laidOut.output);

    expect(tableRule.some((fragment) => fragment.text === expectedRule)).toBe(true);
    expect(fragmentForCellText(fragments, "Name")?.y).toBeLessThan(tableRule[0]!.y);
    expect(fragmentForCellText(fragments, "Alpha")?.y).toBeGreaterThan(tableRule[0]!.y);
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

    expect(texts.some((text) => text.trim() === "Name")).toBe(true);
    expect(texts.some((text) => text.trim() === "Alpha")).toBe(true);
    expect(texts.some((text) => text.trim() === "1")).toBe(true);
    expect(texts.some((text) => text.includes("────"))).toBe(true);
  });

  test("lays out examples/table-page.html with aligned headers and values", async () => {
    const html = await Bun.file("examples/table-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled);
    const laidOut = layout(styled, { viewport: { width: 80, height: 20 } });
    const fragments = tableFragments(table, laidOut.output);

    expect(fragmentForCellText(fragments, "Name")?.x).toBe(fragmentForCellText(fragments, "Alpha")?.x);
    expect(fragmentForCellText(fragments, "Value")?.x).toBe(fragmentForCellText(fragments, "1")?.x);
    expect(fragmentForCellText(fragments, "Name")?.width).toBe(fragmentForCellText(fragments, "Alpha")?.width);
  });

  test("keeps table-page.html columns aligned at 40 columns", async () => {
    const html = await Bun.file("examples/table-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled);
    const laidOut = layout(styled, { viewport: { width: 40, height: 20 } });
    const fragments = tableFragments(table, laidOut.output);

    expect(fragmentForCellText(fragments, "Name")?.x).toBe(fragmentForCellText(fragments, "Beta")?.x);
    expect(fragmentForCellText(fragments, "Value")?.x).toBe(fragmentForCellText(fragments, "2")?.x);
  });

  test("truncates squeezed cells with an ellipsis", () => {
    expect(truncateTableCellText("Quarterly revenue", 4)).toBe("Qua…");
    expect(truncateTableCellText("Quarterly revenue", 1)).toBe(TABLE_ELLIPSIS);
    expect(truncateTableCellText("Alpha", 5)).toBe("Alpha");
  });

  test("pads cells to their column width after truncation", () => {
    expect(formatTableCellText("Name", 5)).toBe("Name ");
    expect(formatTableCellText("Quarterly revenue", 4)).toBe("Qua…");
  });

  test("shrinks rounded column widths to fit the viewport", () => {
    expect(shrinkColumnWidthsToFit([7, 7, 7], 20)).toEqual([6, 6, 6]);
  });

  test("shows ellipsis in narrow table layouts", async () => {
    const html = `
      <table>
        <tr><th>Product</th><th>Revenue</th></tr>
        <tr><td>Quarterly report</td><td>1000000</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled)!;
    const laidOut = layout(styled, { viewport: { width: 14, height: 10 } });
    const fragments = tableFragments(table, laidOut.output);

    const truncated = fragments.find((fragment) => fragment.text.trim().endsWith(TABLE_ELLIPSIS));
    expect(truncated).toBeDefined();
    expect(truncated!.width).toBeLessThanOrEqual("Quarterly report".length);
  });

  test("degrades gracefully at narrow widths with truncated cells", async () => {
    const html = `
      <table>
        <tr><th>Product</th><th>Revenue</th><th>Notes</th></tr>
        <tr><td>Quarterly report</td><td>1000000</td><td>Shipped worldwide</td></tr>
      </table>
    `;
    const styled = await computeStyles(convert(parseHTML(html)));
    const table = findTable(styled)!;
    const viewportWidth = 28;
    const laidOut = layout(styled, { viewport: { width: viewportWidth, height: 10 } });
    const fragments = tableFragments(table, laidOut.output);
    const measured = measureTable(table, viewportWidth);
    const totalWidth =
      measured.columnWidths.reduce((sum, width) => sum + width, 0) +
      (measured.columnCount - 1) * TABLE_CELL_GAP;

    expect(totalWidth).toBeLessThanOrEqual(viewportWidth);
    expect(fragmentForCellText(fragments, "Product")?.x).toBeDefined();
    const productX = fragmentForCellText(fragments, "Product")!.x;
    const dataColumn = fragments.find(
      (fragment) =>
        fragment.x === productX &&
        fragment.y > fragmentForCellText(fragments, "Product")!.y &&
        !fragment.text.includes("─"),
    );
    expect(dataColumn).toBeDefined();
    expect(fragments.some((fragment) => fragment.text.trim().endsWith(TABLE_ELLIPSIS))).toBe(true);
  });
});
