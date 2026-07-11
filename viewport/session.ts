import type { CliRenderer, KeyEvent } from "@opentui/core";

import { linkIndexAtPoint } from "../links/hit";
import type { Link } from "../links/types";
import {
  createLinkFocusState,
  handleLinkKey,
  scrollToFocusedLink,
  type LinkFocusState,
} from "../links/focus";
import { handleHistoryKey } from "../navigation/history-keys";
import { resolveHref } from "../navigation/resolve";
import type { DisplayList } from "../paint/display-list";
import { mountDisplayList, type MountLayout, type MountedDisplayList } from "../render/render";
import {
  createScrollViewport,
  handleScrollKey,
  scrollBy,
  scrollTo,
  type ScrollViewport,
} from "../viewport/scroll";

export interface BrowserSessionOptions {
  pageLocation: string;
  layout: MountLayout;
  onNavigate: (location: string) => void | Promise<void>;
  onHistoryBack?: () => void | Promise<void>;
  onHistoryForward?: () => void | Promise<void>;
}

export interface BrowserSession {
  viewport: ScrollViewport;
  attach: () => void;
  destroy: () => void;
  setFocusedLink: (focusedIndex: number | null) => void;
}

export function createBrowserSession(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
  links: Link[],
  options: BrowserSessionOptions,
): BrowserSession {
  let viewport = createScrollViewport(options.layout.height, contentHeight);
  let linkFocus = createLinkFocusState();
  const mounted: MountedDisplayList = mountDisplayList(
    renderer,
    displayList,
    contentHeight,
    linkFocus.focusedIndex,
    options.layout,
  );

  const syncViewport = (next: ScrollViewport) => {
    viewport = scrollTo(
      {
        ...next,
        viewportHeight: options.layout.height,
        contentHeight,
      },
      next.scrollY,
    );
    mounted.setScrollY(viewport.scrollY);
  };

  const syncLinkFocus = (next: LinkFocusState) => {
    linkFocus = next;
    mounted.setFocusedLink(linkFocus.focusedIndex);

    if (linkFocus.focusedIndex !== null) {
      const link = links[linkFocus.focusedIndex];
      if (link) {
        syncViewport(scrollToFocusedLink(viewport, link));
      }
    }
  };

  const activateLink = async (index: number) => {
    const link = links[index];
    if (!link) return;

    const target = resolveHref(link.href, options.pageLocation);
    if (target) {
      await options.onNavigate(target);
    }
  };

  syncViewport(viewport);

  let keyHandler: ((key: KeyEvent) => void | Promise<void>) | null = null;
  let mouseScrollHandler: NonNullable<typeof mounted.viewport.onMouseScroll> | null = null;
  let mouseMoveHandler: NonNullable<typeof mounted.viewport.onMouseMove> | null = null;
  let mouseUpHandler: NonNullable<typeof mounted.viewport.onMouseUp> | null = null;

  return {
    get viewport() {
      return viewport;
    },
    setFocusedLink(focusedIndex: number | null) {
      syncLinkFocus({ focusedIndex });
    },
    destroy() {
      if (keyHandler) {
        renderer._internalKeyInput.offInternal("keypress", keyHandler);
        keyHandler = null;
      }

      mounted.viewport.onMouseScroll = undefined;
      mounted.viewport.onMouseMove = undefined;
      mounted.viewport.onMouseUp = undefined;
      mouseScrollHandler = null;
      mouseMoveHandler = null;
      mouseUpHandler = null;

      mounted.destroy();
    },
    attach: () => {
      keyHandler = async (key) => {
        const historyAction = handleHistoryKey(key);
        if (historyAction === "back") {
          await options.onHistoryBack?.();
          return;
        }
        if (historyAction === "forward") {
          await options.onHistoryForward?.();
          return;
        }

        const linkResult = handleLinkKey(linkFocus, links.length, key);
        if (linkResult) {
          if (linkResult.kind === "focus") {
            syncLinkFocus(linkResult.state);
            return;
          }

          await activateLink(linkResult.index);
          return;
        }

        const next = handleScrollKey(viewport, key);
        if (!next) return;
        syncViewport(next);
      };

      renderer._internalKeyInput.onInternal("keypress", keyHandler);

      mouseScrollHandler = (event) => {
        if (!event.scroll) return;

        const delta = event.scroll.direction === "down" ? event.scroll.delta : -event.scroll.delta;
        syncViewport(scrollBy(viewport, delta));
      };

      mouseMoveHandler = (event) => {
        const index = linkIndexAtPoint(links, event.x, event.y + viewport.scrollY);
        if (index === linkFocus.focusedIndex) return;
        syncLinkFocus({ focusedIndex: index });
      };

      mouseUpHandler = (event) => {
        if (event.button !== 0 || event.type !== "up") return;

        const index = linkIndexAtPoint(links, event.x, event.y + viewport.scrollY);
        if (index === null) return;

        void activateLink(index);
      };

      mounted.viewport.onMouseScroll = mouseScrollHandler;
      mounted.viewport.onMouseMove = mouseMoveHandler;
      mounted.viewport.onMouseUp = mouseUpHandler;
    },
  };
}

export interface ScrollSession {
  viewport: ScrollViewport;
  attach: () => void;
}

/** Scroll-only session without link navigation. */
export function createScrollSession(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
): ScrollSession {
  const session = createBrowserSession(renderer, displayList, contentHeight, [], {
    pageLocation: "",
    layout: {
      top: 0,
      height: renderer.height,
      width: renderer.width,
    },
    onNavigate: () => {},
  });

  return {
    get viewport() {
      return session.viewport;
    },
    attach: () => session.attach(),
  };
}
