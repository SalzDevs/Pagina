import { CliRenderEvents, createCliRenderer } from "@opentui/core";

import { loadPageContent } from "./navigation/load-page";
import { computeStyles } from "./style/style";
import {
  createBrowserHistory,
  formatBreadcrumb,
  formatLoadingBreadcrumb,
  goBack,
  goForward,
  historyEntryLabel,
  pushHistory,
  updateCurrentHistoryEntry,
  type BrowserHistory,
} from "./navigation/history";
import { normalizePageLocation } from "./navigation/location";
import { PageCache, resolveLoadedPage } from "./navigation/page-cache";
import { splitPageLocation } from "./navigation/fragment";
import { BREADCRUMB_HEIGHT, mountBreadcrumb } from "./render/breadcrumb";
import { mountHelpOverlay } from "./render/help-overlay";
import type { MountLayout } from "./render/render";
import { buildPageView } from "./viewport/page-view";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { clampScrollY } from "./viewport/scroll";

const DEFAULT_PAGE = "examples/page.html";

type HistoryMode = "push" | "none";

type LoadedPage = import("./navigation/page-cache").LoadedPageContent;

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  const breadcrumb = mountBreadcrumb(renderer);
  const help = mountHelpOverlay(renderer);
  let helpVisible = false;
  let history: BrowserHistory = createBrowserHistory();
  const pageCache = new PageCache();
  let session: BrowserSession | null = null;
  let loadedPage: LoadedPage | null = null;
  let rendererStarted = false;

  const startRendererOnce = () => {
    if (rendererStarted) return;
    renderer.start();
    rendererStarted = true;
  };

  const contentLayout = (): MountLayout => ({
    top: BREADCRUMB_HEIGHT,
    width: renderer.width,
    height: Math.max(1, renderer.height - BREADCRUMB_HEIGHT),
  });

  const toggleHelp = () => {
    helpVisible = !helpVisible;
    help.setVisible(helpVisible);
    breadcrumb.update(
      helpVisible ? "Help — press ? to close" : formatBreadcrumb(history, renderer.width),
    );
  };

  const snapshotScrollIntoHistory = () => {
    if (history.index < 0 || !session) return;

    history = updateCurrentHistoryEntry(history, {
      scrollY: session.viewport.scrollY,
    });
  };

  const mountCurrentPage = (
    fragment: string | null = null,
    historyMode: HistoryMode = "none",
    viewState: { preserveViewState?: boolean; restoreScrollY?: number } = {},
  ) => {
    if (!loadedPage) return;

    const previousScrollY = viewState.preserveViewState
      ? (session?.viewport.scrollY ?? 0)
      : (viewState.restoreScrollY ?? 0);
    const previousFocusedLink = viewState.preserveViewState
      ? (session?.focusedLinkIndex ?? null)
      : null;

    session?.destroy();

    const chrome = contentLayout();
    breadcrumb.resize(renderer.width);

    const view = buildPageView(loadedPage.styled, {
      width: chrome.width,
      height: chrome.height,
    });

    if (historyMode === "push") {
      history = pushHistory(history, {
        location: loadedPage.pageLocation,
        label: historyEntryLabel(loadedPage.pageLocation, loadedPage.pageTitle, {
          isErrorPage: loadedPage.isErrorPage,
        }),
      });
    }

    breadcrumb.update(
      helpVisible ? "Help — press ? to close" : formatBreadcrumb(history, renderer.width),
    );

    const initialScrollY = clampScrollY(
      {
        scrollY: previousScrollY,
        viewportHeight: chrome.height,
        contentHeight: view.contentHeight,
      },
      previousScrollY,
    );

    session = createBrowserSession(renderer, view.displayList, view.contentHeight, view.links, {
      pageLocation: loadedPage.pageLocation,
      documentBase: loadedPage.documentBase,
      layout: chrome,
      fragmentPositions: view.fragmentPositions,
      initialScrollY,
      initialFocusedLinkIndex: previousFocusedLink,
      isHelpVisible: () => helpVisible,
      onToggleHelp: toggleHelp,
      onNavigate: (target, targetFragment) => loadPage(target, "push", targetFragment ?? null),
      onHistoryBack: async () => {
        snapshotScrollIntoHistory();
        const result = goBack(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none", null, result.entry.scrollY ?? 0);
      },
      onHistoryForward: async () => {
        snapshotScrollIntoHistory();
        const result = goForward(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none", null, result.entry.scrollY ?? 0);
      },
    });

    if (fragment !== null) {
      session.scrollToFragment(fragment);
    }

    session.attach();
  };

  const ensureStylesForViewport = async (page: LoadedPage, viewportWidth: number) => {
    if (page.stylesViewportWidth === viewportWidth) return page;

    const styled = await computeStyles(page.dom, {
      pageLocation: page.pageLocation,
      documentBase: page.documentBase,
      viewportWidth,
    });
    const updated = {
      ...page,
      styled,
      stylesViewportWidth: viewportWidth,
    };
    pageCache.set(updated);
    return updated;
  };

  const relayoutCurrentPage = async () => {
    if (!loadedPage || !session) return;

    help.resize(renderer.width, renderer.height);
    breadcrumb.resize(renderer.width);

    const chrome = contentLayout();
    loadedPage = await ensureStylesForViewport(loadedPage, chrome.width);

    const view = buildPageView(loadedPage.styled, {
      width: chrome.width,
      height: chrome.height,
    });

    session.relayout(view, chrome);
  };

  const loadPage = async (
    location: string,
    historyMode: HistoryMode = "push",
    fragment: string | null = null,
    restoreScrollY?: number,
  ) => {
    const pageLocation = normalizePageLocation(location);
    breadcrumb.update(formatLoadingBreadcrumb(pageLocation, renderer.width));
    startRendererOnce();

    if (helpVisible) {
      helpVisible = false;
      help.setVisible(false);
    }

    if (historyMode === "push") {
      snapshotScrollIntoHistory();
    }

    session?.destroy();
    session = null;

    loadedPage = await resolveLoadedPage(
      pageLocation,
      pageCache,
      (location) => loadPageContent(location, { viewportWidth: contentLayout().width }),
      {
        forceReload: historyMode === "push",
      },
    );
    loadedPage = await ensureStylesForViewport(loadedPage, contentLayout().width);

    mountCurrentPage(fragment, historyMode, { restoreScrollY });
  };

  renderer.on(CliRenderEvents.RESIZE, relayoutCurrentPage);

  const initial = splitPageLocation(process.argv[2] ?? DEFAULT_PAGE);
  await loadPage(
    initial.location || DEFAULT_PAGE,
    "push",
    initial.fragment,
  );

  startRendererOnce();
}

await main();
