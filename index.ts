import { CliRenderEvents, createCliRenderer, type KeyEvent } from "@opentui/core";

import { loadPageContent } from "./navigation/load-page";
import { computeStyles } from "./style/style";
import {
  createBrowserHistory,
  formatBreadcrumbWithStatus,
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
import { mountLoadingOverlay } from "./render/loading-overlay";
import type { MountLayout } from "./render/render";
import { buildPageView } from "./viewport/page-view";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { clampScrollY } from "./viewport/scroll";
import {
  applyOpenPromptKey,
  createOpenPromptState,
  formatOpenPromptBreadcrumb,
  type OpenPromptState,
} from "./viewport/open-prompt";

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
  const loading = mountLoadingOverlay(renderer);
  let helpVisible = false;
  let openPrompt: OpenPromptState = createOpenPromptState();
  let history: BrowserHistory = createBrowserHistory();
  const pageCache = new PageCache();
  let session: BrowserSession | null = null;
  let loadedPage: LoadedPage | null = null;
  let rendererStarted = false;
  let loadGeneration = 0;

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

  const updateBreadcrumb = () => {
    if (helpVisible) {
      breadcrumb.update("Help — press ? to close");
      return;
    }

    if (openPrompt.active) {
      breadcrumb.update(formatOpenPromptBreadcrumb(openPrompt.value, renderer.width));
      return;
    }

    breadcrumb.update(
      formatBreadcrumbWithStatus(history, renderer.width, {
        cssWarnings: loadedPage?.cssWarnings,
      }),
    );
  };

  const toggleHelp = () => {
    helpVisible = !helpVisible;
    if (helpVisible) {
      openPrompt = createOpenPromptState();
    }
    help.setVisible(helpVisible);
    updateBreadcrumb();
  };

  const handleOpenPromptKey = (key: KeyEvent): boolean => {
    const result = applyOpenPromptKey(openPrompt, key);

    switch (result.kind) {
      case "none":
        return false;
      case "open":
        if (helpVisible) {
          helpVisible = false;
          help.setVisible(false);
        }
        openPrompt = { active: true, value: "" };
        updateBreadcrumb();
        return true;
      case "update":
        openPrompt = result.state;
        updateBreadcrumb();
        return true;
      case "cancel":
        openPrompt = createOpenPromptState();
        updateBreadcrumb();
        return true;
      case "submit":
        openPrompt = createOpenPromptState();
        void loadPage(result.location, "push", result.fragment);
        return true;
    }
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

    loading.hide();

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

    updateBreadcrumb();

    const initialScrollY = clampScrollY(
      {
        scrollY: previousScrollY,
        viewportHeight: chrome.height,
        contentHeight: view.contentHeight,
      },
      previousScrollY,
    );

    session = createBrowserSession(renderer, view.displayList, view.contentWidth, view.contentHeight, view.links, {
      pageLocation: loadedPage.pageLocation,
      documentBase: loadedPage.documentBase,
      layout: chrome,
      fragmentPositions: view.fragmentPositions,
      initialScrollY,
      initialFocusedLinkIndex: previousFocusedLink,
      isHelpVisible: () => helpVisible,
      isOpenPromptVisible: () => openPrompt.active,
      onToggleHelp: toggleHelp,
      onOpenPromptKey: handleOpenPromptKey,
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
    help.resize(renderer.width, renderer.height);
    breadcrumb.resize(renderer.width);
    loading.resize(renderer.width, renderer.height);

    if (!loadedPage || !session) return;

    const chrome = contentLayout();
    loadedPage = await ensureStylesForViewport(loadedPage, chrome.width);

    const view = buildPageView(loadedPage.styled, {
      width: chrome.width,
      height: chrome.height,
    });

    session.relayout(view, chrome);
    updateBreadcrumb();
  };

  const loadPage = async (
    location: string,
    historyMode: HistoryMode = "push",
    fragment: string | null = null,
    restoreScrollY?: number,
  ) => {
    const generation = ++loadGeneration;
    const pageLocation = normalizePageLocation(location);
    breadcrumb.update(formatLoadingBreadcrumb(pageLocation, renderer.width));

    const keepCurrentPageVisible = session !== null;
    if (keepCurrentPageVisible) {
      session?.suspend();
      loading.hide();
    } else {
      loading.show(pageLocation, { dimContent: true });
    }

    startRendererOnce();

    if (helpVisible) {
      helpVisible = false;
      help.setVisible(false);
    }
    openPrompt = createOpenPromptState();

    if (historyMode === "push") {
      snapshotScrollIntoHistory();
    }

    loadedPage = await resolveLoadedPage(
      pageLocation,
      pageCache,
      (location) => loadPageContent(location, { viewportWidth: contentLayout().width }),
      {
        forceReload: historyMode === "push",
      },
    );
    if (generation !== loadGeneration) return;

    loadedPage = await ensureStylesForViewport(loadedPage, contentLayout().width);
    if (generation !== loadGeneration) return;

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
