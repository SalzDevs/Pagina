import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import { loadText } from "../../navigation/load";
import { resolveResource, resolveAgainstBase } from "../../navigation/resolve";
import type { CssRule } from "./types";
import type { MediaContext } from "./parse";
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

export interface CollectStylesheetRulesResult {
  rules: CssRule[];
  warnings: string[];
}

/** Collect CSS rules from inline and linked stylesheets. */
export async function collectStylesheetRules(
  root: Node,
  pageLocation?: string,
  documentBase?: string,
  mediaContext?: MediaContext,
): Promise<CollectStylesheetRulesResult> {
  const sources = collectCssSources(root);
  const base = documentBase ?? pageLocation;
  const { cssByIndex, failedUrls } = await fetchLinkedStylesheetCss(sources, base, pageLocation);

  const rules: CssRule[] = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;

    if (source.kind === "inline") {
      rules.push(...parseStylesheet(source.text, mediaContext));
      continue;
    }

    const css = cssByIndex.get(index);
    if (css) rules.push(...parseStylesheet(css, mediaContext));
  }

  return { rules, warnings: failedUrls };
}

async function fetchLinkedStylesheetCss(
  sources: CssSource[],
  base: string | undefined,
  pageLocation: string | undefined,
): Promise<{ cssByIndex: Map<number, string>; failedUrls: string[] }> {
  const cssByIndex = new Map<number, string>();
  const failedUrls: string[] = [];
  if (!base) return { cssByIndex, failedUrls };

  const linkFetches: Array<{
    index: number;
    resourceLocation: string;
    promise: Promise<string>;
  }> = [];

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
      resourceLocation,
      promise: loadText(resourceLocation),
    });
  }

  if (linkFetches.length === 0) return { cssByIndex, failedUrls };

  const results = await Promise.allSettled(
    linkFetches.map(async ({ index, resourceLocation, promise }) => ({
      index,
      resourceLocation,
      css: await promise,
    })),
  );

  for (let fetchIndex = 0; fetchIndex < results.length; fetchIndex++) {
    const result = results[fetchIndex]!;
    const fetch = linkFetches[fetchIndex]!;

    if (result.status === "fulfilled") {
      cssByIndex.set(result.value.index, result.value.css);
      continue;
    }

    failedUrls.push(fetch.resourceLocation);
  }

  return { cssByIndex, failedUrls };
}
