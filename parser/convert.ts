import type { Node }from "../dom/node";
import { NodeType } from "../dom/node";

export function convert(node: any, parent?: Node): Node {
  let current: Node;

  switch (node.nodeName) {
    case "#document":
      current = {
        type: NodeType.Document,
        parent,
        children: [],
      };
      break;

    case "#text":
      current = {
        type: NodeType.Text,
        parent,
        value: node.value,
      };
      break;

    case "#comment":
      current = {
        type: NodeType.Comment,
        parent,
        value: node.data,
      };
      break;

    case "#documentType":
      current = {
        type: NodeType.Doctype,
        parent,
        value: node.name,
      };
      break;

    default:
      if (!node.tagName) {
        throw new Error(`Unknown node type: ${node.nodeName}`);
      }

      current = {
        type: NodeType.Element,
        parent,
        tag: node.tagName,
        attributes: Object.fromEntries(
          (node.attrs ?? []).map((attr: { name: string; value: string }) => [attr.name, attr.value]),
        ),
        children: [],
      };
  }

  if (current.children && node.childNodes) {
    current.children = node.childNodes.map((child: any) =>
      convert(child, current),
    );
  }

  return current;
}
