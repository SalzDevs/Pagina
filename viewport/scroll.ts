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

/** Apply a key event to the viewport. Returns null when the key is not a scroll binding. */
export function handleScrollKey(viewport: ScrollViewport, key: KeyEvent): ScrollViewport | null {
  if (key.eventType === "release") return null;

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
    case "g":
      return scrollTo(viewport, 0);
    case "end":
    case "G":
      return scrollTo(viewport, maxScrollY(viewport));
    default:
      return null;
  }
}
