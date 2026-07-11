import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";
import type { Link, LinkBounds } from "./types";

function collectFragments(node: StyledNode, out: LinkBounds[]): void {
  if (node.dom.type === NodeType.Text) {
    for (const fragment of node.fragments ?? []) {
      out.push({
        x: fragment.x,
        y: fragment.y,
        width: fragment.width,
        height: fragment.height,
      });
    }
    return;
  }

  for (const child of node.children) {
    collectFragments(child, out);
  }
}

function walk(node: StyledNode, links: Link[]): void {
  if (node.dom.type === NodeType.Element && node.dom.tag === "a") {
    const href = node.dom.attributes?.href;
    if (href) {
      const bounds: LinkBounds[] = [];
      collectFragments(node, bounds);
      if (bounds.length > 0) {
        links.push({ href, bounds });
      }
      return;
    }
  }

  for (const child of node.children) {
    walk(child, links);
  }
}

/** Collect navigable links from a laid-out styled tree, in document order. */
export function collectLinks(root: StyledNode): Link[] {
  const links: Link[] = [];
  walk(root, links);
  return links;
}
