import { resolve } from "node:path";

import { NodeType, type Node } from "../../dom/node";
import { convert } from "../../parser/convert";
import { parseHTML } from "../../parser/html";
import { loadHtmlFromFile } from "../../navigation/load";

const HIDDEN_TAGS = new Set(["script", "style", "noscript", "template", "head", "meta", "link", "title"]);
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "ul",
]);

export interface ReferenceLink {
  href: string;
  text: string;
}

export interface ReferenceImage {
  alt: string | null;
  src: string | null;
}

export interface ReferenceHeading {
  level: number;
  text: string;
}

export interface PageReference {
  pagePath: string;
  title: string | null;
  plainText: string;
  words: string[];
  headings: ReferenceHeading[];
  links: ReferenceLink[];
  images: ReferenceImage[];
  listItems: string[];
  tableCells: string[];
}

function findBody(node: Node): Node | null {
  if (node.type === NodeType.Element && node.tag === "body") return node;
  for (const child of node.children ?? []) {
    const found = findBody(child);
    if (found) return found;
  }
  return null;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[alt:\s*([^\]]+)\]/gi, "$1")
    .replace(/\[image\]/gi, "")
    .match(/[a-z0-9]+/g) ?? [];
}

function pushBlockBreak(parts: string[]): void {
  if (parts.length === 0) return;
  if (!parts[parts.length - 1]!.endsWith("\n")) {
    parts.push("\n");
  }
}

function walkReference(
  node: Node,
  parts: string[],
  headings: ReferenceHeading[],
  links: ReferenceLink[],
  images: ReferenceImage[],
  listItems: string[],
  tableCells: string[],
  options: { inAnchor: boolean; anchorParts: string[]; anchorHref: string | null },
): void {
  if (node.type === NodeType.Text) {
    const value = node.value ?? "";
    if (value.length === 0) return;
    if (options.inAnchor) {
      options.anchorParts.push(value);
    } else {
      parts.push(value);
    }
    return;
  }

  if (node.type !== NodeType.Element || !node.tag) return;
  const tag = node.tag.toLowerCase();
  if (HIDDEN_TAGS.has(tag)) return;

  if (tag === "img") {
    const alt = node.attributes?.alt?.trim() || null;
    const src = node.attributes?.src?.trim() || null;
    images.push({ alt, src });
    const placeholder = alt ? `[alt: ${alt}]` : "[image]";
    parts.push(placeholder);
    return;
  }

  if (tag === "a") {
    const href = node.attributes?.href?.trim();
    if (!href) {
      for (const child of node.children ?? []) {
        walkReference(child, parts, headings, links, images, listItems, tableCells, options);
      }
      return;
    }

    const anchorParts: string[] = [];
    for (const child of node.children ?? []) {
      walkReference(child, parts, headings, links, images, listItems, tableCells, {
        inAnchor: true,
        anchorParts,
        anchorHref: href,
      });
    }
    const text = anchorParts.join("").replace(/\s+/g, " ").trim();
    links.push({ href, text });
    parts.push(text);
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const headingParts: string[] = [];
    for (const child of node.children ?? []) {
      walkReference(child, headingParts, headings, links, images, listItems, tableCells, {
        inAnchor: false,
        anchorParts: [],
        anchorHref: null,
      });
    }
    const text = headingParts.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) headings.push({ level, text });
  }

  if (tag === "li") {
    const itemParts: string[] = [];
    for (const child of node.children ?? []) {
      walkReference(child, itemParts, headings, links, images, listItems, tableCells, {
        inAnchor: false,
        anchorParts: [],
        anchorHref: null,
      });
    }
    const text = itemParts.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) listItems.push(text);
  }

  if (tag === "th" || tag === "td") {
    const cellParts: string[] = [];
    for (const child of node.children ?? []) {
      walkReference(child, cellParts, headings, links, images, listItems, tableCells, {
        inAnchor: false,
        anchorParts: [],
        anchorHref: null,
      });
    }
    const text = cellParts.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) tableCells.push(text);
  }

  if (BLOCK_TAGS.has(tag) && tag !== "img" && tag !== "a") {
    pushBlockBreak(parts);
  }

  for (const child of node.children ?? []) {
    walkReference(child, parts, headings, links, images, listItems, tableCells, {
      inAnchor: false,
      anchorParts: [],
      anchorHref: null,
    });
  }

  if (BLOCK_TAGS.has(tag)) {
    pushBlockBreak(parts);
  }
}

/** Build a browser-like semantic reference from raw HTML. */
export async function buildPageReference(pagePath: string): Promise<PageReference> {
  const resolved = resolve(pagePath);
  const html = await loadHtmlFromFile(resolved);
  const document = convert(parseHTML(html));
  const body = findBody(document);
  if (!body) {
    throw new Error(`No <body> in ${pagePath}`);
  }

  const parts: string[] = [];
  const headings: ReferenceHeading[] = [];
  const links: ReferenceLink[] = [];
  const images: ReferenceImage[] = [];
  const listItems: string[] = [];
  const tableCells: string[] = [];

  walkReference(body, parts, headings, links, images, listItems, tableCells, {
    inAnchor: false,
    anchorParts: [],
    anchorHref: null,
  });

  const plainText = parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let title: string | null = null;
  const walkTitle = (node: Node): void => {
    if (title) return;
    if (node.type === NodeType.Element && node.tag === "title" && node.children?.[0]?.value) {
      title = node.children[0].value!.trim();
      return;
    }
    for (const child of node.children ?? []) walkTitle(child);
  };
  walkTitle(document);

  return {
    pagePath: resolved,
    title,
    plainText,
    words: normalizeWords(plainText),
    headings,
    links,
    images,
    listItems,
    tableCells,
  };
}
