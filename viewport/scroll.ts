import type { KeyEvent } from "@opentui/core";

export interface ScrollViewport {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export function createScrollViewport(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): ScrollViewport {
  return {
    scrollX: 0,
    scrollY: 0,
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
  };
}

export function maxScrollX(viewport: Pick<ScrollViewport, "viewportWidth" | "contentWidth">): number {
  return Math.max(0, viewport.contentWidth - viewport.viewportWidth);
}

export function maxScrollY(viewport: Pick<ScrollViewport, "viewportHeight" | "contentHeight">): number {
  return Math.max(0, viewport.contentHeight - viewport.viewportHeight);
}

export function clampScrollX(viewport: ScrollViewport, scrollX: number): number {
  return Math.min(maxScrollX(viewport), Math.max(0, scrollX));
}

export function clampScrollY(viewport: ScrollViewport, scrollY: number): number {
  return Math.min(maxScrollY(viewport), Math.max(0, scrollY));
}

export function clampScrollViewport(viewport: ScrollViewport): ScrollViewport {
  return {
    ...viewport,
    scrollX: clampScrollX(viewport, viewport.scrollX),
    scrollY: clampScrollY(viewport, viewport.scrollY),
  };
}

export function withScroll(
  viewport: ScrollViewport,
  patch: Partial<Pick<ScrollViewport, "scrollX" | "scrollY">>,
): ScrollViewport {
  return clampScrollViewport({ ...viewport, ...patch });
}

/** @deprecated Use withScroll(viewport, { scrollY }). */
export function scrollTo(viewport: ScrollViewport, scrollY: number): ScrollViewport {
  return withScroll(viewport, { scrollY });
}

export function scrollBy(viewport: ScrollViewport, delta: number): ScrollViewport {
  return withScroll(viewport, { scrollY: viewport.scrollY + delta });
}

export function scrollByX(viewport: ScrollViewport, delta: number): ScrollViewport {
  return withScroll(viewport, { scrollX: viewport.scrollX + delta });
}

/** Scroll so a document row sits at the top of the viewport. */
export function scrollToAlignTop(viewport: ScrollViewport, documentY: number): ScrollViewport {
  return withScroll(viewport, { scrollY: documentY });
}

/** Scroll the viewport so a document row range is visible. */
export function scrollToRevealY(
  viewport: ScrollViewport,
  top: number,
  height = 1,
): ScrollViewport {
  if (top < viewport.scrollY) {
    return withScroll(viewport, { scrollY: top });
  }

  const bottom = top + height;
  if (bottom > viewport.scrollY + viewport.viewportHeight) {
    return withScroll(viewport, { scrollY: bottom - viewport.viewportHeight });
  }

  return viewport;
}

function isScrollKey(key: KeyEvent): boolean {
  if (key.ctrl || key.meta) return false;
  return true;
}

/** Apply a key event to the viewport. Returns null when the key is not a scroll binding. */
export function handleScrollKey(viewport: ScrollViewport, key: KeyEvent): ScrollViewport | null {
  if (key.eventType === "release") return null;
  if (!isScrollKey(key)) return null;

  const pageStep = Math.max(1, viewport.viewportHeight - 1);

  switch (key.name) {
    case "up":
    case "k":
      return scrollBy(viewport, -1);
    case "down":
    case "j":
      return scrollBy(viewport, 1);
    case "pageup":
      return scrollBy(viewport, -pageStep);
    case "pagedown":
      return scrollBy(viewport, pageStep);
    case "home":
      return withScroll(viewport, { scrollY: 0 });
    case "end":
      return withScroll(viewport, { scrollY: maxScrollY(viewport) });
    case "g":
      return withScroll(viewport, { scrollY: key.shift ? maxScrollY(viewport) : 0 });
    case "h":
    case "left":
      return scrollByX(viewport, -1);
    case "l":
    case "right":
      return scrollByX(viewport, 1);
    default:
      return null;
  }
}
