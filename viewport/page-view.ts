import { collectLinks } from "../links/collect";
import { layout, type Viewport } from "../layout/layout";
import { collectFragmentPositions } from "../navigation/anchors";
import { paint } from "../paint/paint";
import type { DisplayList } from "../paint/display-list";
import type { Link } from "../links/types";
import type { StyledNode } from "../style/style";
import { measureContentHeight, measureDisplayListHeight } from "./visible";

export interface PageView {
  displayList: DisplayList;
  links: Link[];
  fragmentPositions: ReadonlyMap<string, number>;
  contentHeight: number;
}

/** Lay out, paint, and collect navigation data for a styled document tree. */
export function buildPageView(styled: StyledNode, viewport: Viewport): PageView {
  layout(styled, { viewport });

  const displayList = paint(styled, { viewportHeight: viewport.height });
  const links = collectLinks(styled);
  const fragmentPositions = collectFragmentPositions(styled);
  const contentHeight = Math.max(
    measureContentHeight(styled),
    measureDisplayListHeight(displayList),
  );

  return {
    displayList,
    links,
    fragmentPositions,
    contentHeight,
  };
}
