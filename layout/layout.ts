import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";

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

export function layout(node: Node): void {
  const ctx: LayoutContext = {
    x: 0,
    y: 0,
  };

  layoutNode(node, ctx);
}

function layoutNode(node: Node, ctx: LayoutContext): void {
  switch (node.type) {
    case NodeType.Document:
      layoutChildren(node, ctx);
      break;

    case NodeType.Element:
      layoutElement(node, ctx);
      break;

    case NodeType.Text:
      node.layout = {
        x: ctx.x,
        y: ctx.y,
        width: node.value?.length ?? 0,
        height: 1,
      };

      ctx.x += node.layout.width;
      break;

    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

function layoutChildren(node: Node, ctx: LayoutContext): void {
  if (!node.children) return;

  for (const child of node.children) {
    layoutNode(child, ctx);
  }
}

function layoutElement(node: Node, ctx: LayoutContext): void {
  switch (node.tag) {
    case "html":
    case "body":
    case "div":
      layoutChildren(node, ctx);
      break;

    case "h1":
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
      break;

    case "p":
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
      break;

    case "br":
      ctx.x = 0;
      ctx.y += 1;
      break;

    default:
      layoutChildren(node, ctx);
      break;
  }
}
