import { layout, type Viewport } from "../layout/layout";
import { paint } from "../paint/paint";
import type { DisplayList } from "../paint/display-list";
import type { Link } from "../links/types";
import type { StyledNode } from "../style/style";
import { measureDisplayListWidth } from "./visible";

export interface PageView {
  displayList: DisplayList;
  links: Link[];
  fragmentPositions: ReadonlyMap<string, number>;
  contentWidth: number;
  contentHeight: number;
}

/** Lay out, paint, and collect navigation data for a styled document tree. */
export function buildPageView(styled: StyledNode, viewport: Viewport): PageView {
  const laidOut = layout(styled, { viewport });
  const painted = paint(styled, laidOut.output, { viewportHeight: viewport.height });

  return {
    displayList: painted.displayList,
    links: painted.links,
    fragmentPositions: laidOut.fragmentPositions,
    contentWidth: measureDisplayListWidth(painted.displayList),
    contentHeight: painted.contentHeight,
  };
}
