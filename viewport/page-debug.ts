import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import type { LoadedPageContent } from "../navigation/page-cache";
import type { ComputedStyle, StyledNode } from "../style/style";

export interface PageDebugContext {
  page: LoadedPageContent;
  viewportWidth?: number;
  viewportHeight?: number;
  contentWidth?: number;
  contentHeight?: number;
  linkCount?: number;
  fragmentCount?: number;
}

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const MAX_DOM_LINES = 80;
const MAX_STYLE_LINES = 40;
const MAX_DOM_DEPTH = 6;

/** Format scrollable debug lines for the current page. */
export function formatPageDebugLines(width: number, context: PageDebugContext | null): string[] {
  const title = "Pagina — page debug";
  const hint = "Press v to close";

  if (!context) {
    return [title, "", "No page loaded.", "", hint];
  }

  const { page } = context;
  const lines: string[] = [title, ""];

  lines.push("Location");
  lines.push(truncateLine(`  ${page.pageLocation}`, width));
  lines.push(truncateLine(`  base: ${page.documentBase}`, width));
  if (page.pageTitle) {
    lines.push(truncateLine(`  title: ${page.pageTitle}`, width));
  }
  lines.push(`  error page: ${page.isErrorPage ? "yes" : "no"}`);

  lines.push("", "Pipeline");
  lines.push(`  styles viewport: ${page.stylesViewportWidth} cols`);
  if (context.viewportWidth !== undefined) {
    lines.push(`  layout viewport: ${context.viewportWidth}x${context.viewportHeight ?? "?"}`);
  }
  if (context.contentWidth !== undefined && context.contentHeight !== undefined) {
    lines.push(`  content size: ${context.contentWidth}x${context.contentHeight}`);
  }
  if (context.linkCount !== undefined) {
    lines.push(`  links: ${context.linkCount}`);
  }
  if (context.fragmentCount !== undefined) {
    lines.push(`  fragment anchors: ${context.fragmentCount}`);
  }

  const domStats = summarizeDom(page.dom);
  lines.push(
    `  dom nodes: ${domStats.total} (${domStats.elements} elements, ${domStats.text} text)`,
  );

  if (page.cssWarnings.length > 0) {
    lines.push("", "CSS warnings");
    for (const warning of page.cssWarnings) {
      lines.push(truncateLine(`  ⚠ ${warning}`, width));
    }
  }

  lines.push("", "DOM (simplified)");
  const domLines: string[] = [];
  const body = findDomElement(page.dom, "body");
  if (body) {
    serializeDom(body, 0, domLines);
  } else {
    serializeDom(page.dom, 0, domLines);
  }
  if (domLines.length >= MAX_DOM_LINES) {
    domLines.push("  ...");
  }
  lines.push(...domLines.map((line) => truncateLine(line, width)));

  lines.push("", "Applied styles (sample)");
  const styleLines: string[] = [];
  const styledBody = findStyledElement(page.styled, "body") ?? page.styled;
  collectStyledSamples(styledBody, styleLines);
  if (styleLines.length >= MAX_STYLE_LINES) {
    styleLines.push("  ...");
  }
  lines.push(...styleLines.map((line) => truncateLine(line, width)));

  lines.push("", hint);
  return lines;
}

function truncateLine(line: string, width: number): string {
  if (width <= 0) return "";
  if (line.length <= width) return line;
  if (width <= 3) return line.slice(0, width);
  return `${line.slice(0, width - 3)}...`;
}

function summarizeDom(root: Node): { total: number; elements: number; text: number } {
  let total = 0;
  let elements = 0;
  let text = 0;

  const walk = (node: Node): void => {
    total++;
    if (node.type === NodeType.Element) elements++;
    if (node.type === NodeType.Text) text++;
    for (const child of node.children ?? []) walk(child);
  };

  walk(root);
  return { total, elements, text };
}

function findDomElement(root: Node, tag: string): Node | null {
  if (root.type === NodeType.Element && root.tag === tag) return root;

  for (const child of root.children ?? []) {
    const found = findDomElement(child, tag);
    if (found) return found;
  }

  return null;
}

function findStyledElement(root: StyledNode, tag: string): StyledNode | null {
  if (root.dom.type === NodeType.Element && root.dom.tag === tag) return root;

  for (const child of root.children) {
    const found = findStyledElement(child, tag);
    if (found) return found;
  }

  return null;
}

function formatAttributes(attributes: Record<string, string> | undefined): string {
  if (!attributes) return "";

  const parts: string[] = [];
  for (const [name, value] of Object.entries(attributes)) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      parts.push(name);
      continue;
    }

    const display =
      trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed.replace(/\s+/g, " ");
    parts.push(`${name}="${display}"`);
  }

  return parts.join(" ");
}

function serializeDom(node: Node, depth: number, lines: string[]): void {
  if (lines.length >= MAX_DOM_LINES || depth > MAX_DOM_DEPTH) return;

  const indent = "  ".repeat(depth + 1);

  if (node.type === NodeType.Element) {
    const tag = node.tag ?? "?";
    const attrs = formatAttributes(node.attributes);
    lines.push(attrs.length > 0 ? `${indent}<${tag} ${attrs}>` : `${indent}<${tag}>`);

    if (!VOID_TAGS.has(tag)) {
      for (const child of node.children ?? []) {
        serializeDom(child, depth + 1, lines);
      }
      if (lines.length < MAX_DOM_LINES) {
        lines.push(`${indent}</${tag}>`);
      }
    }
    return;
  }

  if (node.type === NodeType.Text) {
    const text = (node.value ?? "").trim().replace(/\s+/g, " ");
    if (text.length > 0) {
      const display = text.length > 60 ? `${text.slice(0, 57)}...` : text;
      lines.push(`${indent}"${display}"`);
    }
  }
}

function elementLabel(node: Node): string {
  const tag = node.tag ?? "?";
  const id = node.attributes?.id;
  const className = node.attributes?.class;
  const href = node.attributes?.href;

  let label = tag;
  if (id) label += `#${id}`;
  if (className) label += `.${className.split(/\s+/)[0]}`;
  if (href) {
    const display = href.length > 30 ? `${href.slice(0, 27)}...` : href;
    label += `[href=${display}]`;
  }

  return label;
}

function summarizeStyle(style: ComputedStyle): string | null {
  const parts: string[] = [];

  if (style.display !== "inline") parts.push(`display:${style.display}`);
  if (style.bold) parts.push("bold");
  if (style.italic) parts.push("italic");
  if (style.underline) parts.push("underline");
  if (style.fg) parts.push(`fg:${style.fg}`);
  if (style.bg) parts.push(`bg:${style.bg}`);
  if (style.fontSize !== undefined) parts.push(`fontSize:${style.fontSize}`);
  if (style.whiteSpace && style.whiteSpace !== "normal") {
    parts.push(`white-space:${style.whiteSpace}`);
  }

  const spacing = [
    style.marginTop ? `mt:${style.marginTop}` : "",
    style.marginBottom ? `mb:${style.marginBottom}` : "",
    style.marginLeft ? `ml:${style.marginLeft}` : "",
    style.marginRight ? `mr:${style.marginRight}` : "",
    style.paddingTop ? `pt:${style.paddingTop}` : "",
    style.paddingBottom ? `pb:${style.paddingBottom}` : "",
    style.paddingLeft ? `pl:${style.paddingLeft}` : "",
    style.paddingRight ? `pr:${style.paddingRight}` : "",
  ].filter(Boolean);

  parts.push(...spacing);

  return parts.length > 0 ? parts.join(" ") : null;
}

function collectStyledSamples(node: StyledNode, lines: string[]): void {
  if (lines.length >= MAX_STYLE_LINES) return;

  if (node.dom.type === NodeType.Element) {
    const summary = summarizeStyle(node.style);
    if (summary) {
      lines.push(`  ${elementLabel(node.dom)}: ${summary}`);
    }
  }

  for (const child of node.children) {
    collectStyledSamples(child, lines);
  }
}
