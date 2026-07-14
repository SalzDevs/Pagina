import type { CliRenderer, KeyEvent } from "@opentui/core";

import { buildLinkHitIndex, linkIndexAtPoint, type LinkHitIndex } from "../links/hit";
import { mouseToDocumentPoint } from "./mouse";
import type { Link } from "../links/types";
import {
  createLinkFocusState,
  handleLinkKey,
  scrollToFocusedLink,
  type LinkFocusState,
} from "../links/focus";
import { handleHistoryKey } from "../navigation/history-keys";
import { isHelpToggleKey } from "./help-key";
import { isSamePage, parseLinkTarget } from "../navigation/fragment";
import { scrollToFragment } from "../navigation/anchors";
import type { DisplayList } from "../paint/display-list";
import { mountDisplayList, type MountLayout, type MountedDisplayList } from "../render/render";
import { createKeyboardInput, type KeyboardInput } from "./keyboard";
import type { PageView } from "./page-view";
import {
  createScrollViewport,
  clampScrollY,
  handleScrollKey,
  scrollBy,
  scrollTo,
  type ScrollViewport,
} from "../viewport/scroll";

export interface BrowserSessionOptions {
  pageLocation: string;
  documentBase: string;
  layout: MountLayout;
  fragmentPositions: ReadonlyMap<string, number>;
  initialScrollY?: number;
  initialFocusedLinkIndex?: number | null;
  isHelpVisible?: () => boolean;
  isOpenPromptVisible?: () => boolean;
  onToggleHelp?: () => void;
  onOpenPromptKey?: (key: KeyEvent) => boolean;
  onNavigate: (location: string, fragment?: string | null) => void | Promise<void>;
  onHistoryBack?: () => void | Promise<void>;
  onHistoryForward?: () => void | Promise<void>;
}

export interface BrowserSession {
  viewport: ScrollViewport;
  focusedLinkIndex: number | null;
  attach: () => void;
  /** Detach input handlers while keeping the current page visible. */
  suspend: () => void;
  destroy: () => void;
  relayout: (view: PageView, layout: MountLayout) => void;
  setFocusedLink: (focusedIndex: number | null) => void;
  scrollToFragment: (fragment: string | null) => void;
}

export function createBrowserSession(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
  links: Link[],
  options: BrowserSessionOptions,
): BrowserSession {
  let viewport = scrollTo(
    createScrollViewport(options.layout.height, contentHeight),
    options.initialScrollY ?? 0,
  );
  let linkFocus =
    options.initialFocusedLinkIndex !== undefined
      ? { focusedIndex: options.initialFocusedLinkIndex }
      : createLinkFocusState();
  let pageLinks = links;
  let pageLinkHitIndex: LinkHitIndex = buildLinkHitIndex(links);
  let fragmentPositions = options.fragmentPositions;
  let pageContentHeight = contentHeight;
  let pageLayout = options.layout;
  let pageDisplayList = displayList;

  let lastHoverCell: { x: number; y: number } | null = null;

  const mounted: MountedDisplayList = mountDisplayList(
    renderer,
    pageDisplayList,
    pageContentHeight,
    linkFocus.focusedIndex,
    pageLayout,
  );

  const syncViewport = (next: ScrollViewport) => {
    viewport = scrollTo(
      {
        ...next,
        viewportHeight: pageLayout.height,
        contentHeight: pageContentHeight,
      },
      next.scrollY,
    );
    mounted.setScrollY(viewport.scrollY);
  };

  const syncLinkFocus = (next: LinkFocusState, scroll = false) => {
    linkFocus = next;
    mounted.setFocusedLink(linkFocus.focusedIndex);

    if (!scroll || linkFocus.focusedIndex === null) return;

    const link = pageLinks[linkFocus.focusedIndex];
    if (link) {
      syncViewport(scrollToFocusedLink(viewport, link));
    }
  };

  const activateLink = async (index: number) => {
    const link = pageLinks[index];
    if (!link) return;

    const target = parseLinkTarget(link.href, options.documentBase, options.pageLocation);
    if (!target) return;

    if (target.location === null) {
      syncViewport(scrollToFragment(viewport, fragmentPositions, target.fragment));
      return;
    }

    if (target.fragment !== null && isSamePage(target.location, options.pageLocation)) {
      syncViewport(scrollToFragment(viewport, fragmentPositions, target.fragment));
      return;
    }

    await options.onNavigate(target.location, target.fragment);
  };

  const scrollToFragmentId = (fragment: string | null) => {
    syncViewport(scrollToFragment(viewport, fragmentPositions, fragment));
  };

  const relayout = (view: PageView, layout: MountLayout) => {
    pageDisplayList = view.displayList;
    pageLinks = view.links;
    pageLinkHitIndex = buildLinkHitIndex(view.links);
    fragmentPositions = view.fragmentPositions;
    pageContentHeight = view.contentHeight;
    pageLayout = layout;
    lastHoverCell = null;

    mounted.relayout(
      pageDisplayList,
      pageContentHeight,
      pageLayout,
      linkFocus.focusedIndex,
    );

    syncViewport(
      scrollTo(viewport, clampScrollY(
        {
          scrollY: viewport.scrollY,
          viewportHeight: pageLayout.height,
          contentHeight: pageContentHeight,
        },
        viewport.scrollY,
      )),
    );
  };

  syncViewport(viewport);

  let keyboard: KeyboardInput | null = null;
  let keyHandler: ((key: KeyEvent) => void | Promise<void>) | null = null;
  let mouseScrollHandler: NonNullable<typeof mounted.viewport.onMouseScroll> | null = null;
  let mouseMoveHandler: NonNullable<typeof mounted.viewport.onMouseMove> | null = null;
  let mouseUpHandler: NonNullable<typeof mounted.viewport.onMouseUp> | null = null;

  const detachInputHandlers = () => {
    lastHoverCell = null;
    if (keyHandler && keyboard) {
      keyboard.offKeyPress(keyHandler);
      keyHandler = null;
      keyboard = null;
    }

    mounted.viewport.onMouseScroll = undefined;
    mounted.viewport.onMouseMove = undefined;
    mounted.viewport.onMouseUp = undefined;
    mouseScrollHandler = null;
    mouseMoveHandler = null;
    mouseUpHandler = null;
  };

  return {
    get viewport() {
      return viewport;
    },
    get focusedLinkIndex() {
      return linkFocus.focusedIndex;
    },
    setFocusedLink(focusedIndex: number | null) {
      syncLinkFocus({ focusedIndex }, false);
    },
    scrollToFragment: scrollToFragmentId,
    relayout,
    suspend() {
      detachInputHandlers();
    },
    destroy() {
      detachInputHandlers();
      mounted.destroy();
    },
    attach: () => {
      keyHandler = async (key) => {
        if (isHelpToggleKey(key)) {
          options.onToggleHelp?.();
          return;
        }

        if (options.onOpenPromptKey?.(key)) return;

        if (options.isHelpVisible?.()) return;

        const historyAction = handleHistoryKey(key);
        if (historyAction === "back") {
          await options.onHistoryBack?.();
          return;
        }
        if (historyAction === "forward") {
          await options.onHistoryForward?.();
          return;
        }

        const linkResult = handleLinkKey(linkFocus, pageLinks, key);
        if (linkResult) {
          if (linkResult.kind === "focus") {
            syncLinkFocus(linkResult.state, true);
            return;
          }

          await activateLink(linkResult.index);
          return;
        }

        const next = handleScrollKey(viewport, key);
        if (!next) return;
        syncViewport(next);
      };

      keyboard = createKeyboardInput(renderer);
      keyboard.onKeyPress(keyHandler);

      mouseScrollHandler = (event) => {
        if (options.isHelpVisible?.() || options.isOpenPromptVisible?.()) return;
        if (!event.scroll) return;

        const delta = event.scroll.direction === "down" ? event.scroll.delta : -event.scroll.delta;
        syncViewport(scrollBy(viewport, delta));
      };

      mouseMoveHandler = (event) => {
        if (options.isHelpVisible?.() || options.isOpenPromptVisible?.()) return;

        const point = mouseToDocumentPoint(event, pageLayout, viewport.scrollY);
        const cell = { x: Math.trunc(point.x), y: Math.trunc(point.y) };
        if (
          lastHoverCell?.x === cell.x &&
          lastHoverCell?.y === cell.y
        ) {
          return;
        }

        lastHoverCell = cell;
        const index = linkIndexAtPoint(pageLinkHitIndex, point.x, point.y);
        if (index === linkFocus.focusedIndex) return;
        syncLinkFocus({ focusedIndex: index }, false);
      };

      mouseUpHandler = (event) => {
        if (options.isHelpVisible?.() || options.isOpenPromptVisible?.()) return;
        if (event.button !== 0 || event.type !== "up") return;

        const point = mouseToDocumentPoint(event, pageLayout, viewport.scrollY);
        const index = linkIndexAtPoint(pageLinkHitIndex, point.x, point.y);
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
    documentBase: "",
    layout: {
      top: 0,
      height: renderer.height,
      width: renderer.width,
    },
    fragmentPositions: new Map(),
    onNavigate: () => {},
  });

  return {
    get viewport() {
      return session.viewport;
    },
    attach: () => session.attach(),
  };
}
