import type {Node} from "../dom/node";
import { NodeType } from "../dom/node";
import type { CliRenderer } from "@opentui/core";
import { Text } from "@opentui/core";

export function render(renderer: CliRenderer, node: Node): void {
  switch (node.type) {
    case NodeType.Document:
      renderChildren(renderer, node);
      break;

    case NodeType.Element:
      renderElement(renderer, node);
      break;

    case NodeType.Text:
      if (node.value && node.value.trim().length > 0) {
        renderer.root.add(
          Text({
            content: node.value,
          }),
        );
      }
      break;

    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

export function renderChildren(renderer: CliRenderer, node: Node): void {
  if (!node.children) return;

  for (const child of node.children) {
    render(renderer, child);
  }
}

export function renderElement(renderer: CliRenderer, node: Node): void {
  switch (node.tag) {
    case "html":
    case "body":
    case "div":
      renderChildren(renderer, node);
      break;

    case "h1":
      renderer.root.add(Text({ content: "\n" }));
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "h2":
      renderer.root.add(Text({ content: "\n" }));
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "p":
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "br":
      renderer.root.add(Text({ content: "\n" }));
      break;

    default:
      renderChildren(renderer, node);
      break;
  }
}
