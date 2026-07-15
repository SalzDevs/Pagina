import { resolve } from "node:path";

import { loadPageContent } from "../../navigation/load-page";
import { buildPageView } from "../../viewport/page-view";
import { isTextCommand } from "../../paint/display-list";
import type { Link } from "../../links/types";

export interface PaginaLink {
  href: string;
  text: string;
}

export interface PaginaStyleSample {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface PaginaRender {
  pagePath: string;
  pageTitle?: string;
  plainText: string;
  words: string[];
  headings: string[];
  links: PaginaLink[];
  images: string[];
  listItems: string[];
  tableCells: string[];
  contentWidth: number;
  contentHeight: number;
  cssWarnings: string[];
  styleSamples: PaginaStyleSample[];
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[alt:\s*([^\]]+)\]/gi, "$1")
    .replace(/\[image\]/gi, "")
    .match(/[a-z0-9]+/g) ?? [];
}

function linkTextAtIndex(displayList: ReturnType<typeof buildPageView>["displayList"], index: number): string {
  return displayList
    .filter(isTextCommand)
    .filter((command) => command.linkIndex === index)
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map((command) => command.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function paginaLinks(
  displayList: ReturnType<typeof buildPageView>["displayList"],
  links: Link[],
): PaginaLink[] {
  return links.map((link, index) => ({
    href: link.href,
    text: linkTextAtIndex(displayList, index),
  }));
}

function linearizeDisplayList(displayList: ReturnType<typeof buildPageView>["displayList"]): string {
  const lines = new Map<number, Array<{ x: number; text: string }>>();

  for (const command of displayList) {
    if (!isTextCommand(command)) continue;
    const row = lines.get(command.y) ?? [];
    row.push({ x: command.x, text: command.text });
    lines.set(command.y, row);
  }

  return [...lines.entries()]
    .sort(([leftY], [rightY]) => leftY - rightY)
    .map(([, row]) => {
      const sorted = [...row].sort((left, right) => left.x - right.x);
      let line = "";
      let cursor = 0;

      for (const cell of sorted) {
        const start = Math.max(cursor, cell.x);
        if (start > line.length) {
          line += " ".repeat(start - line.length);
        }
        line += cell.text;
        cursor = line.length;
      }

      return line.trimEnd();
    })
    .join("\n")
    .trim();
}

/** Render a page through Pagina and extract comparable text/structure. */
export async function buildPaginaRender(
  pagePath: string,
  viewport: { width: number; height: number },
): Promise<PaginaRender> {
  const resolved = resolve(pagePath);
  const page = await loadPageContent(resolved, { viewportWidth: viewport.width });
  const view = buildPageView(page.styled, viewport);
  const plainText = linearizeDisplayList(view.displayList);

  const styleSamples = view.displayList
    .filter(isTextCommand)
    .filter((command) => command.fg || command.bg || command.bold || command.italic)
    .slice(0, 40)
    .map((command) => ({
      text: command.text.trim(),
      fg: command.fg,
      bg: command.bg,
      bold: command.bold,
      italic: command.italic,
      underline: command.underline,
    }));

  const images = view.displayList
    .filter(isTextCommand)
    .map((command) => command.text.trim())
    .filter((text) => text.startsWith("[alt:") || text === "[image]");

  const listItems = plainText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(-|\d+\.)\s/.test(line))
    .map((line) => line.replace(/^(-|\d+\.)\s+/, "").trim());

  const tableCells = plainText
    .split("\n")
    .flatMap((line) => line.split(/\s{2,}/))
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0 && !/^─+$/.test(cell));

  const headings = plainText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);

  return {
    pagePath: resolved,
    pageTitle: page.pageTitle,
    plainText,
    words: normalizeWords(plainText),
    headings,
    links: paginaLinks(view.displayList, view.links),
    images,
    listItems,
    tableCells,
    contentWidth: view.contentWidth,
    contentHeight: view.contentHeight,
    cssWarnings: page.cssWarnings,
    styleSamples,
  };
}
