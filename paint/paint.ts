import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import type { DisplayCommand, DisplayList } from "./display-list";

function paintNode(node: Node, commands: DisplayCommand[]): void {
  switch (node.type) {
    case NodeType.Text: {
      if (!node.layout || !node.value) return;

      commands.push({
        x: node.layout.x,
        y: node.layout.y,
        text: node.value,
      });
      return;
    }

    case NodeType.Document:
    case NodeType.Element: {
      if (!node.children) return;
      for (const child of node.children) {
        paintNode(child, commands);
      }
      return;
    }

    case NodeType.Comment:
    case NodeType.Doctype:
      return;
  }
}

/** Convert a laid-out DOM tree into a display list. Does not draw anything. */
export function paint(node: Node): DisplayList {
  const commands: DisplayCommand[] = [];
  paintNode(node, commands);
  return commands;
}
