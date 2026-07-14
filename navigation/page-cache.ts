import type { Node } from "../dom/node";
import type { StyledNode } from "../style/style";

export interface LoadedPageContent {
  pageLocation: string;
  documentBase: string;
  dom: Node;
  styled: StyledNode;
  pageTitle?: string;
  isErrorPage: boolean;
  stylesViewportWidth: number;
  cssWarnings: string[];
}

export class PageCache {
  private readonly entries = new Map<string, LoadedPageContent>();

  get(pageLocation: string): LoadedPageContent | undefined {
    return this.entries.get(pageLocation);
  }

  set(page: LoadedPageContent): void {
    this.entries.set(page.pageLocation, page);
  }

  delete(pageLocation: string): void {
    this.entries.delete(pageLocation);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Load a page from cache or fetch it when history navigation allows reuse. */
export async function resolveLoadedPage(
  pageLocation: string,
  cache: PageCache,
  load: (location: string) => Promise<LoadedPageContent>,
  options: { forceReload: boolean },
): Promise<LoadedPageContent> {
  if (!options.forceReload) {
    const cached = cache.get(pageLocation);
    if (cached) return cached;
  }

  const page = await load(pageLocation);
  cache.set(page);
  return page;
}
