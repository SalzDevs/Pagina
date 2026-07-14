import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";
import { blockBox } from "./box";
import { noteLayoutY } from "./fragment-anchors";
import type { LayoutContext, Viewport } from "./layout";
import type { LayoutFragment } from "./types";

export const IMAGE_FALLBACK_PLACEHOLDER = "[image]";

export function isImgElement(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "img";
}

/** Placeholder text shown in place of an image in the terminal. */
export function imagePlaceholderText(node: StyledNode): string {
  if (node.dom.type !== NodeType.Element) return IMAGE_FALLBACK_PLACEHOLDER;

  const alt = node.dom.attributes?.alt?.trim();
  if (alt) return `[alt: ${alt}]`;

  return IMAGE_FALLBACK_PLACEHOLDER;
}

export interface ImgLayoutDeps {
  addFragment: (node: StyledNode, fragment: LayoutFragment) => void;
  blockGap: number;
}

/** Lay out a block-level image as a single placeholder line. */
export function layoutImgBlock(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: ImgLayoutDeps,
): void {
  void viewport;

  const box = blockBox(node.style, ctx.x, ctx.availableWidth);

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const text = imagePlaceholderText(node);
  deps.addFragment(node, {
    x: box.contentX,
    y: ctx.y,
    width: text.length,
    height: 1,
    text,
  });
  ctx.y += 1;

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
