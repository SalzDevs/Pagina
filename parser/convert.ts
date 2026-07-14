import type { DefaultTreeAdapterTypes } from "parse5";

import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element | DefaultTreeAdapterTypes.Template;
type Parse5TextNode = DefaultTreeAdapterTypes.TextNode;
type Parse5CommentNode = DefaultTreeAdapterTypes.CommentNode;
type Parse5DocumentType = DefaultTreeAdapterTypes.DocumentType;

function attributesFromElement(element: Parse5Element): Record<string, string> {
  return Object.fromEntries(element.attrs.map((attr) => [attr.name, attr.value]));
}

function convertChildNodes(
  childNodes: readonly DefaultTreeAdapterTypes.ChildNode[],
  parent: Node,
): Node[] {
  return childNodes.map((child) => convert(child, parent));
}

function convertContainer(
  parent: Node | undefined,
  childNodes: readonly DefaultTreeAdapterTypes.ChildNode[],
): Node {
  const current: Node = {
    type: NodeType.Document,
    parent,
    children: [],
  };
  current.children = convertChildNodes(childNodes, current);
  return current;
}

export function convert(node: Parse5Node, parent?: Node): Node {
  switch (node.nodeName) {
    case "#document":
      return convertContainer(parent, node.childNodes);

    case "#document-fragment":
      return convertContainer(parent, node.childNodes);

    case "#text":
      return {
        type: NodeType.Text,
        parent,
        value: (node as Parse5TextNode).value,
      };

    case "#comment":
      return {
        type: NodeType.Comment,
        parent,
        value: (node as Parse5CommentNode).data,
      };

    case "#documentType":
      return {
        type: NodeType.Doctype,
        parent,
        value: (node as Parse5DocumentType).name,
      };

    default: {
      if (!("tagName" in node) || !node.tagName) {
        throw new Error(`Unknown node type: ${node.nodeName}`);
      }

      const element = node;
      const current: Node = {
        type: NodeType.Element,
        parent,
        tag: element.tagName,
        attributes: attributesFromElement(element),
        children: [],
      };
      current.children = convertChildNodes(element.childNodes, current);
      return current;
    }
  }
}
