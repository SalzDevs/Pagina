import { NodeType } from "../dom/node";
import type { LayoutFragment } from "./types";
import type { StyledNode } from "../style/style";
import { blockBox } from "./box";
import { noteLayoutY, popFragmentAnchor, pushFragmentAnchor } from "./fragment-anchors";
import type { LayoutContext, Viewport } from "./layout";

export const DEFINITION_INDENT = 4;

export function isDefinitionList(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "dl";
}

export function isDefinitionTerm(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "dt";
}

export function isDefinitionDescription(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "dd";
}

export interface DefinitionLayoutDeps {
  layoutItemContent: (
    node: StyledNode,
    ctx: LayoutContext,
    viewport: Viewport,
    contentWidth: number,
  ) => void;
  blockGap: number;
}

function layoutDefinitionTerm(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: DefinitionLayoutDeps,
): void {
  pushFragmentAnchor(ctx, node);

  const box = blockBox(node.style, ctx.x, ctx.availableWidth);
  const savedX = ctx.x;
  const itemStartY = ctx.y;

  ctx.y += node.style.marginTop ?? 0;
  ctx.x = box.contentX;
  deps.layoutItemContent(node, ctx, viewport, box.contentWidth);
  ctx.x = savedX;

  ctx.y += node.style.paddingBottom ?? 0;
  ctx.y += node.style.marginBottom ?? 0;

  ctx.output.setLayout(node, {
    x: box.layoutX,
    y: itemStartY,
    width: box.layoutWidth,
    height: Math.max(1, ctx.y - itemStartY),
  });
  noteLayoutY(ctx, itemStartY);

  popFragmentAnchor(ctx, node);
}

function layoutDefinitionDescription(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: DefinitionLayoutDeps,
): void {
  pushFragmentAnchor(ctx, node);

  const indent = DEFINITION_INDENT;
  const rowX = ctx.x + indent;
  const rowAvailable = Math.max(1, ctx.availableWidth - indent);
  const box = blockBox(node.style, rowX, rowAvailable);
  const savedX = ctx.x;
  const itemStartY = ctx.y;

  ctx.y += node.style.marginTop ?? 0;
  ctx.x = box.contentX;
  deps.layoutItemContent(node, ctx, viewport, box.contentWidth);
  ctx.x = savedX;

  ctx.y += node.style.paddingBottom ?? 0;
  ctx.y += node.style.marginBottom ?? 0;

  ctx.output.setLayout(node, {
    x: box.layoutX,
    y: itemStartY,
    width: box.layoutWidth,
    height: Math.max(1, ctx.y - itemStartY),
  });
  noteLayoutY(ctx, itemStartY);

  popFragmentAnchor(ctx, node);
}

/** Lay out a definition list with indented descriptions. */
export function layoutDefinitionList(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: DefinitionLayoutDeps,
): void {
  const box = blockBox(node.style, ctx.x, ctx.availableWidth);
  const savedX = ctx.x;
  const savedAvailableWidth = ctx.availableWidth;

  ctx.x = box.contentX;
  ctx.availableWidth = box.contentWidth;

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  for (const child of node.children) {
    if (isDefinitionTerm(child)) {
      layoutDefinitionTerm(child, ctx, viewport, deps);
      continue;
    }

    if (isDefinitionDescription(child)) {
      layoutDefinitionDescription(child, ctx, viewport, deps);
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

  ctx.x = savedX;
  ctx.availableWidth = savedAvailableWidth;
}
