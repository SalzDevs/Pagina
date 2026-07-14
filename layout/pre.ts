import { NodeType } from "../dom/node";
import type { WhiteSpace } from "../style/style";
import type { LayoutFragment } from "./types";
import type { StyledNode } from "../style/style";
import { blockBox } from "./box";
import { noteLayoutY } from "./fragment-anchors";
import type { LayoutContext, Viewport } from "./layout";

export function isPreElement(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "pre";
}

export function usesPreformattedLayout(whiteSpace: WhiteSpace | undefined): boolean {
  return whiteSpace === "pre" || whiteSpace === "pre-wrap";
}

/** Collect text from a subtree without collapsing whitespace. */
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

/** Collect nowrap lines with collapsed whitespace. */
export function collectNowrapLines(node: StyledNode): string[] {
  const lines = [""];

  const walk = (current: StyledNode) => {
    if (current.dom.type === NodeType.Text) {
      lines[lines.length - 1] += current.dom.value ?? "";
      return;
    }

    if (current.dom.type === NodeType.Element && current.dom.tag === "br") {
      lines.push("");
      return;
    }

    for (const child of current.children) {
      walk(child);
    }
  };

  walk(node);

  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 0);
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
  wrapLines?: boolean;
}

/** Lay out a preformatted block line-by-line. */
export function layoutPreBlock(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: PreLayoutDeps,
): void {
  void viewport;

  const box = blockBox(node.style, ctx.x, ctx.availableWidth);

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const text = collectPreformattedText(node);
  const target = firstTextDescendant(node) ?? node;
  const lineHeight = deps.nodeLineHeight(target);

  ctx.y = layoutPreformattedLines(
    target,
    text,
    box.contentX,
    ctx.y,
    box.contentWidth,
    lineHeight,
    deps.addFragment,
    deps.wrapLines ?? false,
  );

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

/** Lay out a nowrap block as one or more unwrapped lines. */
export function layoutNowrapBlock(
  node: StyledNode,
  ctx: LayoutContext,
  viewport: Viewport,
  deps: PreLayoutDeps,
): void {
  void viewport;

  const box = blockBox(node.style, ctx.x, ctx.availableWidth);

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const target = firstTextDescendant(node) ?? node;
  const lineHeight = deps.nodeLineHeight(target);
  const lines = collectNowrapLines(node);

  if (lines.length === 0) {
    ctx.y += lineHeight;
  } else {
    for (const line of lines) {
      deps.addFragment(target, {
        x: box.contentX,
        y: ctx.y,
        width: line.length,
        height: lineHeight,
        text: line,
      });
      ctx.y += lineHeight;
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

export function layoutPreformattedLines(
  target: StyledNode,
  text: string,
  startX: number,
  startY: number,
  contentWidth: number,
  lineHeight: number,
  addFragment: PreLayoutDeps["addFragment"],
  wrapLines = false,
): number {
  let currentY = startY;

  for (const line of text.split("\n")) {
    if (line.length === 0) {
      currentY += lineHeight;
      continue;
    }

    if (!wrapLines) {
      addFragment(target, {
        x: startX,
        y: currentY,
        width: line.length,
        height: lineHeight,
        text: line,
      });
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
