import { NodeType } from "../dom/node";
import { lineHeightForFontSize } from "./line-height";
import type { LayoutFragment, StyledNode } from "../style/style";

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface LayoutOptions {
  viewport: Viewport;
}

export interface LayoutContext {
  x: number;
  y: number;
}

interface InlineSegment {
  node: StyledNode;
  text: string;
}

interface LineRun {
  node: StyledNode;
  text: string;
  x: number;
  width: number;
}

const BLOCK_GAP = 1;
const DEFAULT_VIEWPORT: Viewport = { width: 80, height: 24 };

function nodeLineHeight(node: StyledNode): number {
  return lineHeightForFontSize(node.style.fontSize);
}

function isBlock(node: StyledNode): boolean {
  return node.style.display === "block";
}

function isLineBreak(node: StyledNode): boolean {
  return node.dom.type === "element" && node.dom.tag === "br";
}

function collectInlineSegments(node: StyledNode, out: InlineSegment[]): void {
  if (node.dom.type === "text") {
    out.push({ node, text: node.dom.value ?? "" });
    return;
  }

  if (isLineBreak(node)) {
    out.push({ node, text: "\n" });
    return;
  }

  if (isBlock(node)) return;

  for (const child of node.children) {
    collectInlineSegments(child, out);
  }
}

function addFragment(node: StyledNode, fragment: LayoutFragment): void {
  node.fragments ??= [];
  node.fragments.push(fragment);
}

function wrapSegments(segments: InlineSegment[], contentWidth: number, startY: number): number {
  let currentY = startY;
  let lineRuns: LineRun[] = [];
  let lineWidth = 0;

  const flushLine = () => {
    const lineHeight =
      lineRuns.length === 0 ? 1 : Math.max(...lineRuns.map((run) => nodeLineHeight(run.node)));

    for (const run of lineRuns) {
      addFragment(run.node, {
        x: run.x,
        y: currentY,
        width: run.width,
        height: lineHeight,
        text: run.text,
      });
    }

    if (lineRuns.length > 0) {
      currentY += lineHeight;
    }

    lineRuns = [];
    lineWidth = 0;
  };

  for (const segment of segments) {
    if (segment.text === "\n") {
      flushLine();
      continue;
    }

    const parts = segment.text.split(/(\s+)/).filter((part) => part.length > 0);

    for (const part of parts) {
      const partWidth = part.length;
      const spaceRemaining = contentWidth - lineWidth;

      if (partWidth > contentWidth && lineRuns.length === 0) {
        const chunkHeight = nodeLineHeight(segment.node);
        let offset = 0;
        while (offset < part.length) {
          const chunk = part.slice(offset, offset + contentWidth);
          addFragment(segment.node, {
            x: 0,
            y: currentY,
            width: chunk.length,
            height: chunkHeight,
            text: chunk,
          });
          currentY += chunkHeight;
          offset += contentWidth;
        }
        continue;
      }

      if (lineRuns.length > 0 && partWidth > spaceRemaining && !/^\s+$/.test(part)) {
        flushLine();
      }

      if (/^\s+$/.test(part) && lineRuns.length === 0) {
        continue;
      }

      lineRuns.push({
        node: segment.node,
        text: part,
        x: lineWidth,
        width: partWidth,
      });
      lineWidth += partWidth;
    }
  }

  flushLine();
  return currentY;
}

function layoutInlineBatch(batch: StyledNode[], ctx: LayoutContext, viewport: Viewport): void {
  const segments: InlineSegment[] = [];
  for (const node of batch) {
    collectInlineSegments(node, segments);
  }

  ctx.y = wrapSegments(segments, viewport.width, ctx.y);
  ctx.x = 0;
}

function layoutBlock(node: StyledNode, ctx: LayoutContext, viewport: Viewport): void {
  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  let inlineBatch: StyledNode[] = [];

  const flushInlineBatch = () => {
    if (inlineBatch.length === 0) return;
    layoutInlineBatch(inlineBatch, ctx, viewport);
    inlineBatch = [];
  };

  for (const child of node.children) {
    if (isLineBreak(child)) {
      flushInlineBatch();
      ctx.y += 1;
      continue;
    }

    if (isBlock(child)) {
      flushInlineBatch();
      ctx.x = 0;
      layoutBlock(child, ctx, viewport);
      ctx.x = 0;
      continue;
    }

    inlineBatch.push(child);
  }

  flushInlineBatch();

  ctx.y += node.style.paddingBottom ?? 0;

  const contentHeight = Math.max(1, ctx.y - startY);
  node.layout = {
    x: 0,
    y: startY,
    width: viewport.width,
    height: contentHeight,
  };

  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += BLOCK_GAP;
}

function layoutNode(node: StyledNode, ctx: LayoutContext, viewport: Viewport): void {
  switch (node.dom.type) {
    case NodeType.Document:
      for (const child of node.children) {
        layoutNode(child, ctx, viewport);
      }
      break;

    case NodeType.Element:
      if (isBlock(node)) {
        layoutBlock(node, ctx, viewport);
        break;
      }

      for (const child of node.children) {
        layoutNode(child, ctx, viewport);
      }
      break;

    case NodeType.Text:
    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

function clearLayout(node: StyledNode): void {
  delete node.layout;
  delete node.fragments;

  for (const child of node.children) {
    clearLayout(child);
  }
}

/** Compute geometry for a styled tree. */
export function layout(node: StyledNode, options: LayoutOptions = { viewport: DEFAULT_VIEWPORT }): void {
  clearLayout(node);

  const ctx: LayoutContext = {
    x: 0,
    y: 0,
  };

  layoutNode(node, ctx, options.viewport);
}

export { DEFAULT_VIEWPORT };
