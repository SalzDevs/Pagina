import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import type { CssSelector } from "./types";

function classList(node: Node): string[] {
  if (node.type !== NodeType.Element) return [];
  const value = node.attributes?.class;
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean);
}

function elementId(node: Node): string | undefined {
  if (node.type !== NodeType.Element) return undefined;
  return node.attributes?.id;
}

/** Return true when a DOM element matches a simple CSS selector. */
export function matchesSelector(node: Node, selector: CssSelector): boolean {
  if (node.type !== NodeType.Element) return false;

  const tag = node.tag ?? "";
  const classes = classList(node);
  const id = elementId(node);

  switch (selector.kind) {
    case "tag":
      return tag === selector.tag;
    case "class":
      return classes.includes(selector.className);
    case "id":
      return id === selector.id;
    case "tag-class":
      return tag === selector.tag && classes.includes(selector.className);
    case "tag-id":
      return tag === selector.tag && id === selector.id;
  }
}
