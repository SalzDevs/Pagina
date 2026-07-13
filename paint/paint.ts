import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";
import type { DisplayList, FillCommand, TextCommand } from "./display-list";

export interface PaintOptions {
  viewportHeight?: number;
}

interface PaintContext {
  linkIndex: number | null;
  nextLinkIndex: { value: number };
}

interface PaintOutput {
  fills: FillCommand[];
  texts: TextCommand[];
}

function isBlock(node: StyledNode): boolean {
  return node.style.display === "block";
}

function paintBlockBackground(
  node: StyledNode,
  fills: FillCommand[],
  viewportHeight?: number,
): void {
  if (!isBlock(node) || !node.style.bg || !node.layout) return;

  const tag = node.dom.type === NodeType.Element ? node.dom.tag : undefined;
  let height = node.layout.height;

  if ((tag === "body" || tag === "html") && viewportHeight !== undefined) {
    height = Math.max(height, viewportHeight);
  }

  if (height <= 0 || node.layout.width <= 0) return;

  fills.push({
    kind: "fill",
    x: node.layout.x,
    y: node.layout.y,
    width: node.layout.width,
    height,
    bg: node.style.bg,
  });
}

function paintTextNode(node: StyledNode, texts: TextCommand[], ctx: PaintContext): void {
  const style = {
    fg: node.style.fg,
    bg: node.style.bg,
    bold: node.style.bold || undefined,
    italic: node.style.italic || undefined,
    underline: node.style.underline || undefined,
    linkIndex: ctx.linkIndex ?? undefined,
  };

  if (node.fragments && node.fragments.length > 0) {
    for (const fragment of node.fragments) {
      if (fragment.text.length === 0) continue;

      texts.push({
        kind: "text",
        x: fragment.x,
        y: fragment.y,
        text: fragment.text,
        ...style,
      });
    }
    return;
  }

  if (!node.layout || !node.dom.value) return;

  texts.push({
    kind: "text",
    x: node.layout.x,
    y: node.layout.y,
    text: node.dom.value,
    ...style,
  });
}

function paintNode(
  node: StyledNode,
  output: PaintOutput,
  ctx: PaintContext,
  viewportHeight?: number,
): void {
  switch (node.dom.type) {
    case NodeType.Text:
      paintTextNode(node, output.texts, ctx);
      return;

    case NodeType.Document:
    case NodeType.Element: {
      paintBlockBackground(node, output.fills, viewportHeight);

      if (node.fragments && node.fragments.length > 0) {
        paintTextNode(node, output.texts, ctx);
        return;
      }

      if (node.dom.type === NodeType.Element && node.dom.tag === "a" && node.dom.attributes?.href) {
        const linkIndex = ctx.nextLinkIndex.value;
        ctx.nextLinkIndex.value += 1;

        const linkCtx: PaintContext = {
          linkIndex,
          nextLinkIndex: ctx.nextLinkIndex,
        };

        for (const child of node.children) {
          paintNode(child, output, linkCtx, viewportHeight);
        }
        return;
      }

      for (const child of node.children) {
        paintNode(child, output, ctx, viewportHeight);
      }
      return;
    }

    case NodeType.Comment:
    case NodeType.Doctype:
      return;
  }
}

/** Convert a laid-out styled tree into a display list. Does not draw anything. */
export function paint(node: StyledNode, options: PaintOptions = {}): DisplayList {
  const output: PaintOutput = { fills: [], texts: [] };
  paintNode(node, output, { linkIndex: null, nextLinkIndex: { value: 0 } }, options.viewportHeight);
  return [...output.fills, ...output.texts];
}
