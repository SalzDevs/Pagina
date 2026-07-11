import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import { loadText } from "../../navigation/load";
import { resolveResource } from "../../navigation/resolve";
import type { CssRule } from "./types";
import { parseStylesheet } from "./parse";

type CssSource =
  | { kind: "inline"; text: string }
  | { kind: "link"; href: string };

function stylesheetText(node: Node): string {
  return (
    node.children
      ?.filter((child) => child.type === NodeType.Text)
      .map((child) => child.value ?? "")
      .join("") ?? ""
  );
}

function isStylesheetLink(node: Node): boolean {
  if (node.type !== NodeType.Element || node.tag !== "link") return false;

  const rel = node.attributes?.rel?.toLowerCase() ?? "";
  const href = node.attributes?.href;
  return rel.split(/\s+/).includes("stylesheet") && Boolean(href);
}

/** Collect CSS sources from `<style>` and `<link rel="stylesheet">` in document order. */
export function collectCssSources(root: Node): CssSource[] {
  const sources: CssSource[] = [];

  const walk = (node: Node): void => {
    if (node.type === NodeType.Element && node.tag === "style") {
      const text = stylesheetText(node);
      if (text) sources.push({ kind: "inline", text });
      return;
    }

    if (isStylesheetLink(node)) {
      sources.push({ kind: "link", href: node.attributes!.href! });
      return;
    }

    node.children?.forEach(walk);
  };

  walk(root);
  return sources;
}

/** Collect CSS rules from inline and linked stylesheets. */
export async function collectStylesheetRules(
  root: Node,
  pageLocation?: string,
): Promise<CssRule[]> {
  const sources = collectCssSources(root);
  const rules: CssRule[] = [];

  for (const source of sources) {
    if (source.kind === "inline") {
      rules.push(...parseStylesheet(source.text));
      continue;
    }

    if (!pageLocation) continue;

    const resourceLocation = resolveResource(source.href, pageLocation);
    if (!resourceLocation) continue;

    const css = await loadText(resourceLocation);
    rules.push(...parseStylesheet(css));
  }

  return rules;
}
