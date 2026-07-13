import { layout, type Viewport } from "../layout/layout";
import { paint } from "../paint/paint";
import type { DisplayList } from "../paint/display-list";
import type { Link } from "../links/types";
import type { StyledNode } from "../style/style";

export interface PageView {
  displayList: DisplayList;
  links: Link[];
  fragmentPositions: ReadonlyMap<string, number>;
  contentHeight: number;
}

/** Lay out, paint, and collect navigation data for a styled document tree. */
export function buildPageView(styled: StyledNode, viewport: Viewport): PageView {
  const fragmentPositions = layout(styled, { viewport });
  const painted = paint(styled, { viewportHeight: viewport.height });

  return {
    displayList: painted.displayList,
    links: painted.links,
    fragmentPositions,
    contentHeight: painted.contentHeight,
  };
}
