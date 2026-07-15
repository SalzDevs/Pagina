import { maxScrollY, type ScrollViewport } from "./scroll";

export function isVerticallyScrollable(
  viewport: Pick<ScrollViewport, "viewportHeight" | "contentHeight">,
): boolean {
  return maxScrollY(viewport as ScrollViewport) > 0;
}

export function scrollLinePosition(viewport: ScrollViewport): { line: number; total: number } {
  return {
    line: Math.min(viewport.scrollY + 1, viewport.contentHeight),
    total: viewport.contentHeight,
  };
}

export function scrollPercent(viewport: ScrollViewport): number {
  const maxY = maxScrollY(viewport);
  if (maxY === 0) return 0;
  return Math.round((viewport.scrollY / maxY) * 100);
}

/** Format a compact scroll position suffix for the breadcrumb bar. */
export function formatScrollStatus(viewport: ScrollViewport, width: number): string {
  if (!isVerticallyScrollable(viewport)) return "";

  const { line, total } = scrollLinePosition(viewport);
  const percent = scrollPercent(viewport);
  const variants = [` | ${line}/${total}`, ` | ${percent}%`, ` |${percent}%`];

  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return variants[variants.length - 1]!;
}
