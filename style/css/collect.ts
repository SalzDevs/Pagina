import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import { loadText } from "../../navigation/load";
import { resolveResource, resolveAgainstBase } from "../../navigation/resolve";
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
  documentBase?: string,
): Promise<CssRule[]> {
  const sources = collectCssSources(root);
  const base = documentBase ?? pageLocation;
  const fetchedCssByIndex = await fetchLinkedStylesheetCss(sources, base, pageLocation);

  const rules: CssRule[] = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;

    if (source.kind === "inline") {
      rules.push(...parseStylesheet(source.text));
      continue;
    }

    const css = fetchedCssByIndex.get(index);
    if (css) rules.push(...parseStylesheet(css));
  }

  return rules;
}

async function fetchLinkedStylesheetCss(
  sources: CssSource[],
  base: string | undefined,
  pageLocation: string | undefined,
): Promise<Map<number, string>> {
  const fetchedCssByIndex = new Map<number, string>();
  if (!base) return fetchedCssByIndex;

  const linkFetches: Array<{ index: number; promise: Promise<string | null> }> = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;
    if (source.kind !== "link") continue;

    const resourceLocation = resolveAgainstBase(
      source.href,
      base,
      pageLocation ?? base,
    );
    if (!resourceLocation) continue;

    linkFetches.push({
      index,
      promise: loadText(resourceLocation).catch(() => null),
    });
  }

  if (linkFetches.length === 0) return fetchedCssByIndex;

  const results = await Promise.all(
    linkFetches.map(async ({ index, promise }) => ({
      index,
      css: await promise,
    })),
  );

  for (const { index, css } of results) {
    if (css !== null) fetchedCssByIndex.set(index, css);
  }

  return fetchedCssByIndex;
}
