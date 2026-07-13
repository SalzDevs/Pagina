import { NodeType } from "../dom/node";
import type { LayoutFragment, StyledNode } from "../style/style";
import type { LayoutContext, Viewport } from "./layout";

export function isPreElement(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "pre";
}

/** Collect text from a pre subtree without collapsing whitespace. */
export function collectPreformattedText(node: StyledNode): string {
  let text = "";

  const walk = (current: StyledNode) => {
    if (current.dom.type === NodeType.Text) {
      text += current.dom.value ?? "";
      return;
    }

    if (current.dom.type === NodeType.Element && current.dom.tag === "br") {
      text += "\n";
      return;
    }

    if (current.dom.type === NodeType.Element && current.dom.tag === "pre" && current !== node) {
      return;
    }

    for (const child of current.children) {
      walk(child);
    }
  };

  walk(node);
  return text;
}

/** Prefer the first text descendant so paint keeps inline styles from code spans. */
export function firstTextDescendant(node: StyledNode): StyledNode | null {
  if (node.dom.type === NodeType.Text) return node;

  for (const child of node.children) {
    const found = firstTextDescendant(child);
    if (found) return found;
  }

  return null;
}

export interface PreLayoutDeps {
  addFragment: (node: StyledNode, fragment: LayoutFragment) => void;
  nodeLineHeight: (node: StyledNode) => number;
  blockGap: number;
}

/** Lay out a pre block line-by-line without word wrapping. */
export function layoutPreBlock(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: PreLayoutDeps,
): void {
  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const contentWidth = Math.max(1, viewport.width - ctx.x);
  const text = collectPreformattedText(node);
  const target = firstTextDescendant(node) ?? node;
  const lineHeight = deps.nodeLineHeight(target);

  ctx.y = layoutPreformattedLines(
    target,
    text,
    ctx.x,
    ctx.y,
    contentWidth,
    lineHeight,
    deps.addFragment,
  );

  ctx.y += node.style.paddingBottom ?? 0;

  node.layout = {
    x: ctx.x,
    y: startY,
    width: contentWidth,
    height: Math.max(1, ctx.y - startY),
  };

  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += deps.blockGap;
}

export function layoutPreformattedLines(
  target: StyledNode,
  text: string,
  startX: number,
  startY: number,
  contentWidth: number,
  lineHeight: number,
  addFragment: PreLayoutDeps["addFragment"],
): number {
  let currentY = startY;

  for (const line of text.split("\n")) {
    if (line.length === 0) {
      currentY += lineHeight;
      continue;
    }

    let offset = 0;
    while (offset < line.length) {
      const chunk = line.slice(offset, offset + contentWidth);
      addFragment(target, {
        x: startX,
        y: currentY,
        width: chunk.length,
        height: lineHeight,
        text: chunk,
      });
      currentY += lineHeight;
      offset += contentWidth;
    }
  }

  return currentY;
}
