import type { KeyEvent } from "@opentui/core";

export interface ScrollViewport {
  scrollY: number;
  viewportHeight: number;
  contentHeight: number;
}

export function createScrollViewport(
  viewportHeight: number,
  contentHeight: number,
): ScrollViewport {
  return {
    scrollY: 0,
    viewportHeight,
    contentHeight,
  };
}

export function maxScrollY(viewport: ScrollViewport): number {
  return Math.max(0, viewport.contentHeight - viewport.viewportHeight);
}

export function clampScrollY(viewport: ScrollViewport, scrollY: number): number {
  return Math.min(maxScrollY(viewport), Math.max(0, scrollY));
}

export function scrollTo(viewport: ScrollViewport, scrollY: number): ScrollViewport {
  return {
    ...viewport,
    scrollY: clampScrollY(viewport, scrollY),
  };
}

export function scrollBy(viewport: ScrollViewport, delta: number): ScrollViewport {
  return scrollTo(viewport, viewport.scrollY + delta);
}

/** Scroll so a document row sits at the top of the viewport. */
export function scrollToAlignTop(viewport: ScrollViewport, documentY: number): ScrollViewport {
  return scrollTo(viewport, documentY);
}

/** Scroll the viewport so a document row range is visible. */
export function scrollToRevealY(
  viewport: ScrollViewport,
  top: number,
  height = 1,
): ScrollViewport {
  if (top < viewport.scrollY) {
    return scrollTo(viewport, top);
  }

  const bottom = top + height;
  if (bottom > viewport.scrollY + viewport.viewportHeight) {
    return scrollTo(viewport, bottom - viewport.viewportHeight);
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
      return scrollTo(viewport, 0);
    case "end":
      return scrollTo(viewport, maxScrollY(viewport));
    case "g":
      return scrollTo(viewport, key.shift ? maxScrollY(viewport) : 0);
    default:
      return null;
  }
}
