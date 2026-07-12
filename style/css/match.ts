import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import type { CssSelector, SimpleSelector } from "./types";

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
export function matchesSimpleSelector(node: Node, selector: SimpleSelector): boolean {
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

function matchesDescendant(node: Node, chain: SimpleSelector[], ancestors: readonly Node[]): boolean {
  const target = chain[chain.length - 1];
  if (!target || !matchesSimpleSelector(node, target)) return false;

  let ancestorIndex = ancestors.length - 1;

  for (let partIndex = chain.length - 2; partIndex >= 0; partIndex--) {
    const part = chain[partIndex]!;
    let matched = false;

    while (ancestorIndex >= 0) {
      const ancestor = ancestors[ancestorIndex]!;
      ancestorIndex--;

      if (matchesSimpleSelector(ancestor, part)) {
        matched = true;
        break;
      }
    }

    if (!matched) return false;
  }

  return true;
}

/** Return true when a DOM element matches a CSS selector within its ancestor chain. */
export function matchesSelector(
  node: Node,
  selector: CssSelector,
  ancestors: readonly Node[] = [],
): boolean {
  if (selector.kind === "descendant") {
    return matchesDescendant(node, selector.chain, ancestors);
  }

  return matchesSimpleSelector(node, selector);
}
