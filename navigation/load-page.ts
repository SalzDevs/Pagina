import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles } from "../style/style";
import { resolveDocumentBase } from "./base-url";
import { buildErrorPageHtml } from "./error-page";
import { extractPageTitle, isErrorPageTitle } from "./history";
import { isFetchAborted, loadHtml } from "./load";
import type { LoadedPageContent } from "./page-cache";

export interface LoadPageOptions {
  viewportWidth?: number;
  signal?: AbortSignal;
}

/** Fetch, parse, and style a page from disk or the network. */
export async function loadPageContent(
  pageLocation: string,
  options: LoadPageOptions = {},
): Promise<LoadedPageContent> {
  let html: string;
  let isErrorPage = false;

  try {
    html = await loadHtml(pageLocation, { signal: options.signal });
  } catch (error) {
    if (isFetchAborted(error)) throw error;
    html = buildErrorPageHtml(pageLocation, error);
    isErrorPage = true;
  }

  const document = parseHTML(html);
  const dom = convert(document);
  const documentBase = resolveDocumentBase(dom, pageLocation);
  const pageTitle = extractPageTitle(dom);

  if (!isErrorPage && isErrorPageTitle(pageTitle)) {
    isErrorPage = true;
  }

  const cssWarnings: string[] = [];
  const styled = await computeStyles(dom, {
    pageLocation,
    documentBase,
    viewportWidth: options.viewportWidth,
    cssWarnings,
  });

  return {
    pageLocation,
    documentBase,
    dom,
    styled,
    pageTitle,
    isErrorPage,
    stylesViewportWidth: options.viewportWidth ?? 80,
    cssWarnings,
  };
}
