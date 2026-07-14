import { NodeType } from "../dom/node";
import { blockBox } from "./box";
import {
  addTrackedFragment,
  noteLayoutY,
  popFragmentAnchor,
  pushFragmentAnchor,
  type FragmentTracking,
} from "./fragment-anchors";
import {
  lineHeightForFontSize,
  textWrapUnits,
  wrapCharacterBudget,
} from "./line-height";
import { isHrElement, layoutHr } from "./hr";
import { imagePlaceholderText, isImgElement, layoutImgBlock } from "./img";
import { isListContainer, layoutListContainer } from "./lists";
import { LayoutOutput } from "./output";
import { layoutPreBlock, isPreElement } from "./pre";
import type { LayoutBox, LayoutFragment } from "./types";
import { isBlock } from "../style/display";
import type { StyledNode } from "../style/style";

export type { LayoutBox } from "./types";

export interface Viewport {
  width: number;
  height: number;
}

export interface LayoutOptions {
  viewport: Viewport;
}

export interface LayoutResult {
  fragmentPositions: ReadonlyMap<string, number>;
  output: LayoutOutput;
}

export interface LayoutContext extends FragmentTracking {
  x: number;
  y: number;
  listDepth: number;
  availableWidth: number;
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

  if (isImgElement(node)) {
    out.push({ node, text: imagePlaceholderText(node) });
    return;
  }

  if (isBlock(node)) return;

  for (const child of node.children) {
    collectInlineSegments(child, out);
  }
}

function wrapSegments(
  ctx: LayoutContext,
  segments: InlineSegment[],
  contentWidth: number,
  startY: number,
  startX: number,
): number {
  let currentY = startY;
  let lineRuns: LineRun[] = [];
  let lineWidth = 0;
  let lineUnits = 0;

  const flushLine = () => {
    const lineHeight =
      lineRuns.length === 0 ? 1 : Math.max(...lineRuns.map((run) => nodeLineHeight(run.node)));

    for (const run of lineRuns) {
      addTrackedFragment(ctx, run.node, {
        x: startX + run.x,
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
    lineUnits = 0;
  };

  for (const segment of segments) {
    if (segment.text === "\n") {
      flushLine();
      continue;
    }

    const parts = segment.text.split(/(\s+)/).filter((part) => part.length > 0);
    const segmentFontSize = segment.node.style.fontSize;

    for (const part of parts) {
      const partWidth = part.length;
      const partUnits = textWrapUnits(part, segmentFontSize);
      const spaceRemainingUnits = contentWidth - lineUnits;
      const maxCharsOnLine = wrapCharacterBudget(contentWidth, segmentFontSize);

      if (partUnits > contentWidth && lineRuns.length === 0) {
        const chunkHeight = nodeLineHeight(segment.node);
        let offset = 0;
        while (offset < part.length) {
          const chunk = part.slice(offset, offset + maxCharsOnLine);
          addTrackedFragment(ctx, segment.node, {
            x: startX,
            y: currentY,
            width: chunk.length,
            height: chunkHeight,
            text: chunk,
          });
          currentY += chunkHeight;
          offset += maxCharsOnLine;
        }
        continue;
      }

      if (lineRuns.length > 0 && partUnits > spaceRemainingUnits && !/^\s+$/.test(part)) {
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
      lineUnits += partUnits;
    }
  }

  flushLine();
  return currentY;
}

function layoutInlineBatch(
  batch: StyledNode[],
  ctx: LayoutContext,
  viewport: Viewport,
  contentWidth = ctx.availableWidth,
): void {
  const segments: InlineSegment[] = [];
  for (const node of batch) {
    collectInlineSegments(node, segments);
  }

  ctx.y = wrapSegments(ctx, segments, contentWidth, ctx.y, ctx.x);
}

function layoutFragmentScope(
  ctx: LayoutContext,
  node: StyledNode,
  layout: () => void,
): void {
  pushFragmentAnchor(ctx, node);
  layout();
  popFragmentAnchor(ctx, node);
}

function layoutNestedList(node: StyledNode, ctx: LayoutContext, viewport: Viewport): void {
  ctx.listDepth += 1;
  layoutListContainer(node, ctx, viewport, {
    addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
    layoutListItemContent,
    blockGap: BLOCK_GAP,
  });
  ctx.listDepth -= 1;
}

function layoutListItemContent(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  contentWidth: number,
): void {
  ctx.y += node.style.paddingTop ?? 0;

  let inlineBatch: StyledNode[] = [];

  const flushInlineBatch = () => {
    if (inlineBatch.length === 0) return;
    layoutInlineBatch(inlineBatch, ctx, viewport, contentWidth);
    inlineBatch = [];
  };

  for (const child of node.children) {
    if (isLineBreak(child)) {
      flushInlineBatch();
      ctx.y += 1;
      continue;
    }

    if (isListContainer(child)) {
      flushInlineBatch();
      layoutNestedList(child, ctx, viewport);
      continue;
    }

    if (isBlock(child)) {
      flushInlineBatch();
      layoutBlock(child, ctx, viewport);
      continue;
    }

    inlineBatch.push(child);
  }

  flushInlineBatch();
}

function layoutBlock(node: StyledNode, ctx: LayoutContext, viewport: Viewport): void {
  layoutFragmentScope(ctx, node, () => {
    if (isListContainer(node)) {
      layoutListContainer(node, ctx, viewport, {
        addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
        layoutListItemContent,
        blockGap: BLOCK_GAP,
      });
      return;
    }

    if (isPreElement(node)) {
      layoutPreBlock(node, ctx, viewport, {
        addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
        nodeLineHeight,
        blockGap: BLOCK_GAP,
      });
      return;
    }

    if (isHrElement(node)) {
      layoutHr(node, ctx, {
        addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
        blockGap: BLOCK_GAP,
      });
      return;
    }

    if (isImgElement(node)) {
      layoutImgBlock(node, ctx, viewport, {
        addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
        blockGap: BLOCK_GAP,
      });
      return;
    }

    const box = blockBox(node.style, ctx.x, ctx.availableWidth);
    const savedX = ctx.x;
    const savedAvailableWidth = ctx.availableWidth;
    ctx.x = box.contentX;
    ctx.availableWidth = box.contentWidth;

    ctx.y += node.style.marginTop ?? 0;
    const startY = ctx.y;
    ctx.y += node.style.paddingTop ?? 0;

    let inlineBatch: StyledNode[] = [];

    const flushInlineBatch = () => {
      if (inlineBatch.length === 0) return;
      layoutInlineBatch(inlineBatch, ctx, viewport, box.contentWidth);
      inlineBatch = [];
    };

    for (const child of node.children) {
      if (isLineBreak(child)) {
        flushInlineBatch();
        ctx.y += 1;
        continue;
      }

      if (isListContainer(child)) {
        flushInlineBatch();
        layoutListContainer(child, ctx, viewport, {
          addFragment: (target, fragment) => addTrackedFragment(ctx, target, fragment),
          layoutListItemContent,
          blockGap: BLOCK_GAP,
        });
        continue;
      }

      if (isBlock(child)) {
        flushInlineBatch();
        layoutBlock(child, ctx, viewport);
        continue;
      }

      inlineBatch.push(child);
    }

    flushInlineBatch();

    ctx.y += node.style.paddingBottom ?? 0;

    const contentHeight = Math.max(1, ctx.y - startY);
    ctx.output.setLayout(node, {
      x: box.layoutX,
      y: startY,
      width: box.layoutWidth,
      height: contentHeight,
    });
    noteLayoutY(ctx, startY);

    ctx.y += node.style.marginBottom ?? 0;
    ctx.y += BLOCK_GAP;

    ctx.x = savedX;
    ctx.availableWidth = savedAvailableWidth;
  });
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

      layoutFragmentScope(ctx, node, () => {
        for (const child of node.children) {
          layoutNode(child, ctx, viewport);
        }
      });
      break;

    case NodeType.Text:
    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

/** Compute geometry for a styled tree. */
export function layout(
  node: StyledNode,
  options: LayoutOptions = { viewport: DEFAULT_VIEWPORT },
): LayoutResult {
  const output = new LayoutOutput();
  const fragmentPositions = new Map<string, number>();
  const ctx: LayoutContext = {
    x: 0,
    y: 0,
    listDepth: 0,
    availableWidth: options.viewport.width,
    fragmentPositions,
    fragmentAnchorStack: [],
    output,
  };

  layoutNode(node, ctx, options.viewport);
  return { fragmentPositions, output };
}

export { DEFAULT_VIEWPORT };
