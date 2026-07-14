import { NodeType } from "../dom/node";
import type { LayoutFragment } from "./types";
import type { StyledNode } from "../style/style";
import { blockBox } from "./box";
import { noteLayoutY } from "./fragment-anchors";
import type { LayoutContext, Viewport } from "./layout";
import { firstTextDescendant } from "./pre";
import { HR_CHARACTER } from "./hr";

export const TABLE_CELL_GAP = 2;
export const MIN_TABLE_COLUMN_WIDTH = 3;
export const TABLE_ELLIPSIS = "…";

export function isTableElement(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "table";
}

export function collectTableRows(table: StyledNode): StyledNode[] {
  const rows: StyledNode[] = [];

  const walk = (node: StyledNode): void => {
    if (node.dom.type === NodeType.Element && node.dom.tag === "tr") {
      rows.push(node);
      return;
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(table);
  return rows;
}

export function collectRowCells(row: StyledNode): StyledNode[] {
  return row.children.filter(
    (child) =>
      child.dom.type === NodeType.Element &&
      (child.dom.tag === "td" || child.dom.tag === "th"),
  );
}

/** Flatten a cell subtree into a single line of text. */
export function collectCellText(cell: StyledNode): string {
  let text = "";

  const walk = (node: StyledNode): void => {
    if (node.dom.type === NodeType.Text) {
      text += node.dom.value ?? "";
      return;
    }

    if (node.dom.type === NodeType.Element && node.dom.tag === "br") {
      text += " ";
      return;
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(cell);
  return text.replace(/\s+/g, " ").trim();
}

export interface TableMeasurements {
  rows: StyledNode[];
  cellTexts: string[][];
  columnCount: number;
  columnWidths: number[];
}

export function measureTable(table: StyledNode, contentWidth: number): TableMeasurements {
  const rows = collectTableRows(table);
  const cellTexts = rows.map((row) => collectRowCells(row).map(collectCellText));
  const columnCount = Math.max(0, ...cellTexts.map((row) => row.length));
  const columnWidths = Array.from({ length: columnCount }, () => 0);

  for (const row of cellTexts) {
    for (let column = 0; column < columnCount; column++) {
      const text = row[column] ?? "";
      columnWidths[column] = Math.max(columnWidths[column]!, text.length);
    }
  }

  return {
    rows,
    cellTexts,
    columnCount,
    columnWidths: fitColumnWidths(columnWidths, contentWidth, TABLE_CELL_GAP),
  };
}

export function fitColumnWidths(
  columnWidths: number[],
  contentWidth: number,
  gap: number,
  minColumnWidth = MIN_TABLE_COLUMN_WIDTH,
): number[] {
  if (columnWidths.length === 0) return columnWidths;

  const gaps = Math.max(0, columnWidths.length - 1) * gap;
  const total = columnWidths.reduce((sum, width) => sum + width, 0) + gaps;
  if (total <= contentWidth) return columnWidths;

  const available = Math.max(columnWidths.length, contentWidth - gaps);
  const natural = columnWidths.reduce((sum, width) => sum + width, 0);
  if (natural === 0) return columnWidths.map(() => 1);

  for (const floor of [minColumnWidth, 1] as const) {
    const widths = proportionalColumnWidths(columnWidths, available, natural, floor);
    if (widths.reduce((sum, width) => sum + width, 0) <= available) {
      return widths;
    }
  }

  return proportionalColumnWidths(columnWidths, available, natural, 1);
}

function proportionalColumnWidths(
  columnWidths: number[],
  available: number,
  natural: number,
  floor: number,
): number[] {
  return columnWidths.map((width) => Math.max(floor, Math.floor((width * available) / natural)));
}

/** Trim cell text to a column width and append an ellipsis when truncated. */
export function truncateTableCellText(text: string, width: number): string {
  if (width <= 0 || text.length === 0) return "";
  if (text.length <= width) return text;
  if (width === 1) return TABLE_ELLIPSIS;
  return `${text.slice(0, width - TABLE_ELLIPSIS.length)}${TABLE_ELLIPSIS}`;
}

export function columnOffsets(columnWidths: number[], startX: number, gap: number): number[] {
  const offsets: number[] = [];
  let x = startX;

  for (let column = 0; column < columnWidths.length; column++) {
    offsets.push(x);
    x += columnWidths[column]! + gap;
  }

  return offsets;
}

/** Build a header underline that spans each column width. */
export function formatTableHeaderRule(columnWidths: number[], gap: number): string {
  if (columnWidths.length === 0) return "";

  return columnWidths
    .map((width) => HR_CHARACTER.repeat(Math.max(1, width)))
    .join(" ".repeat(gap));
}

export function rowHasHeaderCells(row: StyledNode): boolean {
  return collectRowCells(row).some(
    (cell) => cell.dom.type === NodeType.Element && cell.dom.tag === "th",
  );
}

export interface TableLayoutDeps {
  addFragment: (node: StyledNode, fragment: LayoutFragment) => void;
  nodeLineHeight: (node: StyledNode) => number;
  blockGap: number;
}

/** Lay out a table as aligned monospace columns. */
export function layoutTable(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: TableLayoutDeps,
): void {
  void viewport;

  const box = blockBox(node.style, ctx.x, ctx.availableWidth);

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const { rows, cellTexts, columnCount, columnWidths } = measureTable(node, box.contentWidth);
  const offsets = columnOffsets(columnWidths, box.contentX, TABLE_CELL_GAP);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const cells = collectRowCells(row);
    const texts = cellTexts[rowIndex] ?? [];
    const rowHeight = Math.max(
      1,
      ...cells.map((cell) => deps.nodeLineHeight(firstTextDescendant(cell) ?? cell)),
    );

    for (let column = 0; column < columnCount; column++) {
      const cell = cells[column];
      const rawText = texts[column] ?? "";
      const text = truncateTableCellText(rawText, columnWidths[column]!);
      if (!cell || text.length === 0) continue;

      deps.addFragment(cell, {
        x: offsets[column]!,
        y: ctx.y,
        width: text.length,
        height: rowHeight,
        text,
      });
    }

    ctx.y += rowHeight;

    if (rowIndex === 0 && rowHasHeaderCells(row)) {
      const rule = formatTableHeaderRule(columnWidths, TABLE_CELL_GAP);
      deps.addFragment(node, {
        x: offsets[0]!,
        y: ctx.y,
        width: rule.length,
        height: 1,
        text: rule,
      });
      ctx.y += 1;
    }
  }

  ctx.y += node.style.paddingBottom ?? 0;

  ctx.output.setLayout(node, {
    x: box.layoutX,
    y: startY,
    width: box.layoutWidth,
    height: Math.max(1, ctx.y - startY),
  });
  noteLayoutY(ctx, startY);

  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += deps.blockGap;
}
