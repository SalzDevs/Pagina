import { NodeType } from "../dom/node";
import type { LayoutFragment, StyledNode } from "../style/style";
import type { LayoutContext, Viewport } from "./layout";

export const LIST_INDENT = 2;
export const BULLET_MARKER = "- ";

export function isListContainer(node: StyledNode): boolean {
  return (
    node.dom.type === NodeType.Element &&
    (node.dom.tag === "ul" || node.dom.tag === "ol")
  );
}

export function isListItem(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "li";
}

export function orderedListStart(node: StyledNode): number {
  if (node.dom.type !== NodeType.Element || node.dom.tag !== "ol") return 1;

  const raw = node.dom.attributes?.start;
  if (!raw) return 1;

  const start = Number.parseInt(raw, 10);
  return Number.isNaN(start) ? 1 : start;
}

export function formatListMarker(ordered: boolean, index: number): string {
  return ordered ? `${index}. ` : BULLET_MARKER;
}

export function listItemIndent(depth: number): number {
  return depth * LIST_INDENT;
}

export interface ListItemLayoutOptions {
  ordered: boolean;
  markerIndex: number;
  depth: number;
  addFragment: (node: StyledNode, fragment: LayoutFragment) => void;
  layoutListItemContent: (
    node: StyledNode,
    ctx: LayoutContext,
    viewport: Viewport,
    contentWidth: number,
  ) => void;
  blockGap: number;
}

/** Lay out a single list item with a bullet or number marker. */
export function layoutListItem(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  options: ListItemLayoutOptions,
): void {
  const indent = listItemIndent(options.depth);
  const marker = formatListMarker(options.ordered, options.markerIndex);
  const contentX = indent + marker.length;
  const contentWidth = Math.max(1, viewport.width - contentX);

  const itemStartY = ctx.y;
  ctx.y += node.style.marginTop ?? 0;

  options.addFragment(node, {
    x: indent,
    y: ctx.y,
    width: marker.length,
    height: 1,
    text: marker,
  });

  const savedX = ctx.x;
  ctx.x = contentX;
  options.layoutListItemContent(node, ctx, viewport, contentWidth);
  ctx.x = savedX;

  ctx.y += node.style.paddingBottom ?? 0;
  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += options.blockGap;

  node.layout = {
    x: indent,
    y: itemStartY,
    width: Math.max(1, viewport.width - indent),
    height: Math.max(1, ctx.y - itemStartY),
  };
}

export interface ListContainerLayoutOptions {
  addFragment: ListItemLayoutOptions["addFragment"];
  layoutListItemContent: ListItemLayoutOptions["layoutListItemContent"];
  blockGap: number;
}

/** Lay out the direct list items of a ul or ol element. */
export function layoutListContainer(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  options: ListContainerLayoutOptions,
): void {
  const ordered = node.dom.type === NodeType.Element && node.dom.tag === "ol";
  let counter = ordered ? orderedListStart(node) : 1;

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  for (const child of node.children) {
    if (!isListItem(child)) continue;

    layoutListItem(child, ctx, viewport, {
      ordered,
      markerIndex: counter,
      depth: ctx.listDepth,
      addFragment: options.addFragment,
      layoutListItemContent: options.layoutListItemContent,
      blockGap: options.blockGap,
    });

    if (ordered) counter += 1;
  }

  ctx.y += node.style.paddingBottom ?? 0;

  node.layout = {
    x: 0,
    y: startY,
    width: viewport.width,
    height: Math.max(1, ctx.y - startY),
  };

  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += options.blockGap;
}
