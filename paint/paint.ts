import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";
import type { DisplayCommand, DisplayList } from "./display-list";

function paintNode(node: StyledNode, commands: DisplayCommand[]): void {
  switch (node.dom.type) {
    case NodeType.Text: {
      if (!node.layout || !node.dom.value) return;

      commands.push({
        x: node.layout.x,
        y: node.layout.y,
        text: node.dom.value,
        fg: node.style.fg,
        bg: node.style.bg,
        bold: node.style.bold || undefined,
        italic: node.style.italic || undefined,
        underline: node.style.underline || undefined,
      });
      return;
    }

    case NodeType.Document:
    case NodeType.Element: {
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

/** Convert a laid-out styled tree into a display list. Does not draw anything. */
export function paint(node: StyledNode): DisplayList {
  const commands: DisplayCommand[] = [];
  paintNode(node, commands);
  return commands;
}
