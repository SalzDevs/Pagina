import { NodeType } from "../dom/node";
import type { LayoutOutput } from "../layout/output";
import type { StyledNode } from "../style/style";
import type { Link, LinkBounds } from "./types";

function collectFragments(node: StyledNode, layout: LayoutOutput, out: LinkBounds[]): void {
  if (node.dom.type === NodeType.Text) {
    for (const fragment of layout.getFragments(node)) {
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
    collectFragments(child, layout, out);
  }
}

function walk(node: StyledNode, layout: LayoutOutput, links: Link[]): void {
  if (node.dom.type === NodeType.Element && node.dom.tag === "a") {
    const href = node.dom.attributes?.href;
    if (href) {
      const bounds: LinkBounds[] = [];
      collectFragments(node, layout, bounds);
      if (bounds.length > 0) {
        links.push({ href, bounds });
      }
      return;
    }
  }

  for (const child of node.children) {
    walk(child, layout, links);
  }
}

/** Collect navigable links from a laid-out styled tree, in document order. */
export function collectLinks(root: StyledNode, layout: LayoutOutput): Link[] {
  const links: Link[] = [];
  walk(root, layout, links);
  return links;
}
