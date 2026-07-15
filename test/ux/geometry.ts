import { resolve } from "node:path";

import { loadPageContent } from "../../navigation/load-page";
import { buildPageView } from "../../viewport/page-view";
import { BREADCRUMB_HEIGHT } from "../../render/breadcrumb";
import { buildLinkHitIndex, linkIndexAtPoint } from "../../links/hit";
import { mouseToDocumentPoint } from "../../viewport/mouse";
import {
  historyTargetAtBreadcrumbColumn,
  layoutBreadcrumb,
  type BrowserHistory,
} from "../../navigation/history";

export interface UxLayout {
  width: number;
  height: number;
  scrollY?: number;
}

/** Map a link index to root-relative screen coordinates for mouse events. */
export async function linkScreenPoint(
  pagePath: string,
  linkIndex: number,
  layout: UxLayout,
): Promise<{ x: number; y: number }> {
  const resolved = resolve(pagePath);
  const page = await loadPageContent(resolved, { viewportWidth: layout.width });
  const contentHeight = Math.max(1, layout.height - BREADCRUMB_HEIGHT);
  const view = buildPageView(page.styled, { width: layout.width, height: contentHeight });
  const bound = view.links[linkIndex]?.bounds[0];
  if (!bound) {
    throw new Error(`Link ${linkIndex} not found on ${pagePath}`);
  }

  const scrollY = layout.scrollY ?? 0;
  return {
    x: bound.x,
    y: BREADCRUMB_HEIGHT + bound.y - scrollY,
  };
}

/** Pick a breadcrumb click point for a history entry or the picker affordance. */
export function breadcrumbClickPoint(
  history: BrowserHistory,
  width: number,
  target: number | "picker",
): { x: number; y: number } {
  const layout = layoutBreadcrumb(history, width);

  if (target === "picker") {
    if (!layout.ellipsis) {
      throw new Error("Breadcrumb picker affordance is not visible");
    }
    const column = layout.ellipsis.start;
    return { x: column + 1, y: 0 };
  }

  const segment = layout.segments.find((entry) => entry.index === target);
  if (!segment) {
    throw new Error(`History segment ${target} is not visible in the breadcrumb`);
  }

  const column = segment.start;
  if (historyTargetAtBreadcrumbColumn(layout, column) !== target) {
    throw new Error(`Breadcrumb column ${column} does not map to history index ${target}`);
  }

  return { x: column + 1, y: 0 };
}

/** Find screen coordinates over content that are not on a link. */
export async function emptyContentPoint(
  pagePath: string,
  layout: UxLayout,
  scrollY: number,
): Promise<{ x: number; y: number }> {
  const resolved = resolve(pagePath);
  const page = await loadPageContent(resolved, { viewportWidth: layout.width });
  const contentHeight = Math.max(1, layout.height - BREADCRUMB_HEIGHT);
  const view = buildPageView(page.styled, { width: layout.width, height: contentHeight });
  const hitIndex = buildLinkHitIndex(view.links);
  const chrome = { top: BREADCRUMB_HEIGHT };

  for (let screenY = BREADCRUMB_HEIGHT; screenY < layout.height; screenY++) {
    for (let screenX = 0; screenX < layout.width; screenX++) {
      const point = mouseToDocumentPoint({ x: screenX, y: screenY }, chrome, scrollY);
      if (linkIndexAtPoint(hitIndex, point.x, point.y) === null) {
        return { x: screenX, y: screenY };
      }
    }
  }

  throw new Error(`No empty content cell found on ${pagePath}`);
}
