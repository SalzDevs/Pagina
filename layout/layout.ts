import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutContext {
  x: number;
  y: number;
}

export function layout(node: StyledNode): void {
  const ctx: LayoutContext = {
    x: 0,
    y: 0,
  };

  layoutNode(node, ctx);
}

function layoutNode(node: StyledNode, ctx: LayoutContext): void {
  switch (node.dom.type) {
    case NodeType.Document:
      layoutChildren(node, ctx);
      break;

    case NodeType.Element:
      if (node.dom.tag === "br") {
        ctx.x = 0;
        ctx.y += 1;
        break;
      }

      if (node.style.display === "block") {
        layoutBlock(node, ctx);
        break;
      }

      layoutChildren(node, ctx);
      break;

    case NodeType.Text:
      node.layout = {
        x: ctx.x,
        y: ctx.y,
        width: node.dom.value?.length ?? 0,
        height: 1,
      };

      ctx.x += node.layout.width;
      break;

    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

function layoutBlock(node: StyledNode, ctx: LayoutContext): void {
  ctx.x = 0;

  node.layout = {
    x: 0,
    y: ctx.y,
    width: 0,
    height: 1,
  };

  layoutChildren(node, ctx);

  ctx.x = 0;
  ctx.y += 2;
}

function layoutChildren(node: StyledNode, ctx: LayoutContext): void {
  for (const child of node.children) {
    layoutNode(child, ctx);
  }
}
