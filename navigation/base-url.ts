import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { resolveResource } from "./resolve";

/** Return the first `<base href>` value in document order, if any. */
export function extractBaseHref(root: Node): string | undefined {
  let href: string | undefined;

  const walk = (node: Node): boolean => {
    if (node.type === NodeType.Element && node.tag === "base") {
      const value = node.attributes?.href?.trim();
      if (value) {
        href = value;
        return true;
      }
    }

    for (const child of node.children ?? []) {
      if (walk(child)) return true;
    }

    return false;
  };

  walk(root);
  return href;
}

/** Resolve the document base URL used for relative links and stylesheets. */
export function resolveDocumentBase(root: Node, pageLocation: string): string {
  const baseHref = extractBaseHref(root);
  if (!baseHref) {
    return pageLocation.split("#")[0] ?? pageLocation;
  }

  const resolved = resolveResource(baseHref, pageLocation);
  return resolved ?? pageLocation.split("#")[0] ?? pageLocation;
}
