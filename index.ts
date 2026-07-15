import { CliRenderEvents, createCliRenderer, type KeyEvent } from "@opentui/core";

import { loadPageContent } from "./navigation/load-page";
import { isFetchAborted } from "./navigation/load";
import { computeStyles } from "./style/style";
import {
  createBrowserHistory,
  formatBreadcrumbWithStatus,
  formatLoadCancelledBreadcrumb,
  formatLoadingBreadcrumb,
  goBack,
  goForward,
  goToHistoryIndex,
  historyEntryLabel,
  layoutBreadcrumb,
  historyTargetAtBreadcrumbColumn,
  pushHistory,
  updateCurrentHistoryEntry,
  type BrowserHistory,
} from "./navigation/history";
import { normalizePageLocation } from "./navigation/location";
import { PageCache, resolveLoadedPage } from "./navigation/page-cache";
import { splitPageLocation } from "./navigation/fragment";
import { isRemoteUrl } from "./navigation/resolve";
import { BREADCRUMB_HEIGHT, mountBreadcrumb } from "./render/breadcrumb";
import { mountHelpOverlay } from "./render/help-overlay";
import { mountHistoryOverlay } from "./render/history-overlay";
import { mountLoadingOverlay } from "./render/loading-overlay";
import type { MountLayout } from "./render/render";
import { createKeyboardInput } from "./viewport/keyboard";
import { isLoadCancelKey } from "./viewport/load-cancel-key";
import { buildPageView } from "./viewport/page-view";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { clampScrollY } from "./viewport/scroll";
import { formatScrollStatus, isVerticallyScrollable } from "./viewport/scroll-indicator";
import {
  focusableLinkCount,
  formatLinkHintStatus,
  initialLinkFocusIndex,
} from "./links/focus";
import {
  applyOpenPromptKey,
  createOpenPromptState,
  formatOpenPromptBreadcrumb,
  type OpenPromptState,
} from "./viewport/open-prompt";
import { OpenPromptHistory } from "./viewport/open-prompt-history";
import {
  applySearchKey,
  createSearchState,
  formatSearchPromptBreadcrumb,
  formatSearchStatus,
  stepSearchMatchIndex,
  type SearchMatch,
  type SearchState,
} from "./viewport/search";
import {
  applyHistoryPickerKey,
  activateHistoryPicker,
  createHistoryPickerState,
  type HistoryPickerState,
} from "./viewport/history-picker";

const DEFAULT_PAGE = "examples/page.html";

type HistoryMode = "push" | "none";

type LoadedPage = import("./navigation/page-cache").LoadedPageContent;

interface LoadPageOptions {
  forceReload?: boolean;
}

interface HistoryViewState {
  scrollY?: number;
  focusedLinkIndex?: number | null;
  fragment?: string | null;
}

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  const breadcrumb = mountBreadcrumb(renderer);
  const help = mountHelpOverlay(renderer);
  const historyOverlay = mountHistoryOverlay(renderer);
  const loading = mountLoadingOverlay(renderer);
  let helpVisible = false;
  let historyPicker: HistoryPickerState = createHistoryPickerState();
  let openPrompt: OpenPromptState = createOpenPromptState();
  const openPromptHistory = new OpenPromptHistory();
  let search: SearchState = createSearchState();
  let searchMatches: SearchMatch[] = [];
  let history: BrowserHistory = createBrowserHistory();
  const pageCache = new PageCache();
  let session: BrowserSession | null = null;
  let loadedPage: LoadedPage | null = null;
  let fragmentNotFound: string | null = null;
  let unsupportedLink: string | null = null;
  let rendererStarted = false;
  let loadGeneration = 0;
  let loadAbortController: AbortController | null = null;
  let currentFocusableLinkCount = 0;

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

  const syncCssWarnings = () => {
    help.setCssWarnings(loadedPage?.cssWarnings ?? []);
  };

  const breadcrumbExtraSuffix = (): string => {
    let suffix = "";
    let remaining = renderer.width;

    if (search.query && !fragmentNotFound && !unsupportedLink) {
      const status = formatSearchStatus(
        search.query,
        search.matchIndex,
        searchMatches.length,
        remaining,
      );
      suffix += status;
      remaining = Math.max(0, remaining - status.length);
    }

    if (session && isVerticallyScrollable(session.viewport)) {
      const scrollStatus = formatScrollStatus(session.viewport, remaining);
      suffix += scrollStatus;
      remaining = Math.max(0, remaining - scrollStatus.length);
    }

    if (session?.focusedLinkIndex === null && currentFocusableLinkCount > 0) {
      const hint = formatLinkHintStatus(currentFocusableLinkCount, remaining);
      suffix += hint;
    }

    return suffix;
  };

  const historyBreadcrumbWidth = (): number => {
    const breadcrumbWidth = renderer.width - breadcrumbExtraSuffix().length;
    return breadcrumbWidth >= 0 ? breadcrumbWidth : renderer.width;
  };

  const closeHistoryPicker = () => {
    historyPicker = createHistoryPickerState();
    historyOverlay.setVisible(false);
    updateBreadcrumb();
  };

  const openHistoryPicker = () => {
    if (history.entries.length === 0) return;
    historyPicker = activateHistoryPicker(history);
    historyOverlay.setHistory(history, historyPicker.selectedIndex);
    historyOverlay.setVisible(true);
    updateBreadcrumb();
  };

  const updateBreadcrumb = () => {
    if (helpVisible) {
      breadcrumb.update("Help — press ? to close");
      return;
    }

    if (historyPicker.active) {
      breadcrumb.update("History — ↑/↓ to select, Enter to go, Esc to close");
      return;
    }

    if (openPrompt.active) {
      breadcrumb.update(
        formatOpenPromptBreadcrumb(openPrompt.value, renderer.width, openPrompt.cursor),
      );
      return;
    }

    if (search.promptActive) {
      breadcrumb.update(
        formatSearchPromptBreadcrumb(search.value, renderer.width, search.cursor),
      );
      return;
    }

    const extraSuffix = breadcrumbExtraSuffix();
    const historyWidth = renderer.width - extraSuffix.length;
    let line = formatBreadcrumbWithStatus(
      history,
      historyWidth >= 0 ? historyWidth : renderer.width,
      {
        cssWarnings: loadedPage?.cssWarnings,
        fragmentNotFound,
        unsupportedLink,
      },
    );

    if (extraSuffix && historyWidth >= 0) {
      line += extraSuffix;
    }

    breadcrumb.update(line);
  };

  const applySearch = () => {
    if (!session || !search.query) {
      session?.clearSearchHighlight();
      searchMatches = [];
      return;
    }

    searchMatches = session.findSearchMatches(search.query);
    if (searchMatches.length === 0) {
      search.matchIndex = 0;
      session.clearSearchHighlight();
    } else {
      search = {
        ...search,
        matchIndex: Math.min(search.matchIndex, searchMatches.length - 1),
      };
      session.showSearch(searchMatches, search.matchIndex);
    }
  };

  const toggleHelp = () => {
    helpVisible = !helpVisible;
    if (helpVisible) {
      openPrompt = createOpenPromptState();
      search = createSearchState();
      searchMatches = [];
      session?.clearSearchHighlight();
      closeHistoryPicker();
    }
    help.setVisible(helpVisible);
    updateBreadcrumb();
  };

  const handleHistoryPickerKey = (key: KeyEvent): boolean => {
    if (openPrompt.active || search.promptActive) return false;

    const result = applyHistoryPickerKey(historyPicker, key, history);

    switch (result.kind) {
      case "none":
        return false;
      case "open":
        if (helpVisible) {
          helpVisible = false;
          help.setVisible(false);
        }
        historyPicker = result.state;
        historyOverlay.setHistory(history, historyPicker.selectedIndex);
        historyOverlay.setVisible(true);
        updateBreadcrumb();
        return true;
      case "update":
        historyPicker = result.state;
        historyOverlay.setHistory(history, historyPicker.selectedIndex);
        return true;
      case "cancel":
        closeHistoryPicker();
        return true;
      case "submit":
        void navigateToHistoryIndex(result.index);
        return true;
    }
  };

  const handleOpenPromptKey = (key: KeyEvent): boolean => {
    const result = applyOpenPromptKey(openPrompt, key, { history: openPromptHistory });

    switch (result.kind) {
      case "none":
        return false;
      case "open":
        if (helpVisible) {
          helpVisible = false;
          help.setVisible(false);
        }
        openPrompt = result.state;
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
        openPromptHistory.add(result.location);
        openPrompt = createOpenPromptState();
        void loadPage(result.location, "push", result.fragment);
        return true;
    }
  };

  const handleSearchKey = (key: KeyEvent): boolean => {
    if (openPrompt.active) return false;

    const result = applySearchKey(search, key);

    switch (result.kind) {
      case "none":
        return false;
      case "open":
        if (helpVisible) {
          helpVisible = false;
          help.setVisible(false);
        }
        search = result.state;
        updateBreadcrumb();
        return true;
      case "update":
        search = result.state;
        updateBreadcrumb();
        return true;
      case "cancel":
        search = createSearchState();
        searchMatches = [];
        session?.clearSearchHighlight();
        updateBreadcrumb();
        return true;
      case "submit":
        search = result.state;
        applySearch();
        updateBreadcrumb();
        return true;
      case "navigate":
        if (searchMatches.length === 0) return true;
        search = {
          ...result.state,
          matchIndex: stepSearchMatchIndex(
            search.matchIndex,
            searchMatches.length,
            result.direction,
          ),
        };
        session?.showSearch(searchMatches, search.matchIndex);
        updateBreadcrumb();
        return true;
    }
  };

  const snapshotViewStateIntoHistory = () => {
    if (history.index < 0 || !session) return;

    history = updateCurrentHistoryEntry(history, {
      scrollY: session.viewport.scrollY,
      focusedLinkIndex: session.focusedLinkIndex,
    });
  };

  const navigateToHistoryIndex = async (index: number) => {
    if (index < 0 || index >= history.entries.length || index === history.index) {
      closeHistoryPicker();
      return;
    }

    snapshotViewStateIntoHistory();
    const result = goToHistoryIndex(history, index);
    history = result.history;
    if (!result.entry) return;

    closeHistoryPicker();
    await loadPage(result.entry.location, "none", null, {
      scrollY: result.entry.scrollY,
      focusedLinkIndex: result.entry.focusedLinkIndex,
      fragment: result.entry.fragment,
    });
  };

  const mountCurrentPage = (
    fragment: string | null = null,
    historyMode: HistoryMode = "none",
    viewState: {
      preserveViewState?: boolean;
      restoreScrollY?: number;
      restoreFocusedLinkIndex?: number | null;
      restoreFragment?: string | null;
    } = {},
  ) => {
    if (!loadedPage) return;

    loading.hide();

    const hasSavedScroll = viewState.restoreScrollY !== undefined;
    const previousScrollY = viewState.preserveViewState
      ? (session?.viewport.scrollY ?? 0)
      : hasSavedScroll
        ? viewState.restoreScrollY!
        : 0;
    const previousFocusedLinkBeforeDestroy = viewState.preserveViewState
      ? (session?.focusedLinkIndex ?? null)
      : (viewState.restoreFocusedLinkIndex ?? null);

    session?.destroy();

    const chrome = contentLayout();
    breadcrumb.resize(renderer.width);

    const view = buildPageView(loadedPage.styled, {
      width: chrome.width,
      height: chrome.height,
    });

    const previousFocusedLink =
      previousFocusedLinkBeforeDestroy !== null &&
      previousFocusedLinkBeforeDestroy >= 0 &&
      previousFocusedLinkBeforeDestroy < view.links.length
        ? previousFocusedLinkBeforeDestroy
        : null;

    const visitFragment =
      historyMode === "none" && viewState.restoreFragment !== undefined
        ? viewState.restoreFragment
        : fragment;

    const visitingFragment =
      (visitFragment !== null && !hasSavedScroll && !viewState.preserveViewState) ||
      (fragment !== null && historyMode === "push");

    currentFocusableLinkCount = focusableLinkCount(view.links);

    const initialFocusedLink = initialLinkFocusIndex(view.links, {
      restoredIndex: previousFocusedLink,
      hasSavedScroll,
      visitingFragment,
    });

    if (historyMode === "push") {
      history = pushHistory(history, {
        location: loadedPage.pageLocation,
        label: historyEntryLabel(loadedPage.pageLocation, loadedPage.pageTitle, {
          isErrorPage: loadedPage.isErrorPage,
        }),
        fragment: fragment ?? undefined,
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
      initialFocusedLinkIndex: initialFocusedLink,
      initialFocusedLinkScroll:
        initialFocusedLink !== null && previousFocusedLink === null && !hasSavedScroll,
      isHelpVisible: () => helpVisible,
      isOpenPromptVisible: () => openPrompt.active,
      isSearchPromptVisible: () => search.promptActive,
      isHistoryPickerVisible: () => historyPicker.active,
      onToggleHelp: toggleHelp,
      onOpenPromptKey: handleOpenPromptKey,
      onSearchKey: handleSearchKey,
      onHistoryPickerKey: handleHistoryPickerKey,
      onNavigate: (target, targetFragment) => loadPage(target, "push", targetFragment ?? null),
      onHistoryBack: async () => {
        snapshotViewStateIntoHistory();
        const result = goBack(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none", null, {
          scrollY: result.entry.scrollY,
          focusedLinkIndex: result.entry.focusedLinkIndex,
          fragment: result.entry.fragment,
        });
      },
      onHistoryForward: async () => {
        snapshotViewStateIntoHistory();
        const result = goForward(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none", null, {
          scrollY: result.entry.scrollY,
          focusedLinkIndex: result.entry.focusedLinkIndex,
          fragment: result.entry.fragment,
        });
      },
      onFragmentNotFound: (fragment) => {
        fragmentNotFound = fragment;
        if (fragment) unsupportedLink = null;
        updateBreadcrumb();
      },
      onUnsupportedLink: (href) => {
        unsupportedLink = href;
        if (href) fragmentNotFound = null;
        updateBreadcrumb();
      },
      onScrollChange: updateBreadcrumb,
      onLinkFocusChange: updateBreadcrumb,
    });

    if (visitFragment !== null && !hasSavedScroll && !viewState.preserveViewState) {
      session.scrollToFragment(visitFragment);
    } else if (fragment !== null && historyMode === "push") {
      session.scrollToFragment(fragment);
    }

    session.attach();
    updateBreadcrumb();
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
    historyOverlay.resize(renderer.width, renderer.height);
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
    applySearch();
    updateBreadcrumb();
    syncCssWarnings();
  };

  const loadPage = async (
    location: string,
    historyMode: HistoryMode = "push",
    fragment: string | null = null,
    restore: HistoryViewState = {},
    options: LoadPageOptions = {},
  ) => {
    const generation = ++loadGeneration;
    const pageLocation = normalizePageLocation(location);
    const forceReload = options.forceReload ?? false;
    fragmentNotFound = null;
    unsupportedLink = null;

    if (historyMode === "push") {
      snapshotViewStateIntoHistory();
    }

    startRendererOnce();

    if (helpVisible) {
      helpVisible = false;
      help.setVisible(false);
    }
    openPrompt = createOpenPromptState();
    search = createSearchState();
    searchMatches = [];
    closeHistoryPicker();

    const cachedPage = !forceReload ? pageCache.get(pageLocation) : undefined;
    if (cachedPage) {
      loadedPage = await ensureStylesForViewport(cachedPage, contentLayout().width);
      if (generation !== loadGeneration) return;

      mountCurrentPage(fragment, historyMode, {
        restoreScrollY: restore.scrollY,
        restoreFocusedLinkIndex: restore.focusedLinkIndex,
        restoreFragment: restore.fragment,
      });
      syncCssWarnings();
      return;
    }

    loadAbortController?.abort();
    const abortController = new AbortController();
    loadAbortController = abortController;

    breadcrumb.update(
      formatLoadingBreadcrumb(pageLocation, renderer.width, {
        cancellable: isRemoteUrl(pageLocation),
      }),
    );

    const keepCurrentPageVisible = session !== null;
    if (keepCurrentPageVisible) {
      session?.suspend();
      loading.hide();
    } else {
      loading.show(pageLocation, { dimContent: true });
    }

    const cancelKeyboard = createKeyboardInput(renderer);
    const onLoadingKey = (key: KeyEvent) => {
      if (!isLoadCancelKey(key)) return;
      abortController.abort();
    };
    cancelKeyboard.onKeyPress(onLoadingKey);

    try {
      loadedPage = await resolveLoadedPage(
        pageLocation,
        pageCache,
        (location) =>
          loadPageContent(location, {
            viewportWidth: contentLayout().width,
            signal: abortController.signal,
          }),
        {
          forceReload,
        },
      );
      if (generation !== loadGeneration) return;

      loadedPage = await ensureStylesForViewport(loadedPage, contentLayout().width);
      if (generation !== loadGeneration) return;

      mountCurrentPage(fragment, historyMode, {
        restoreScrollY: restore.scrollY,
        restoreFocusedLinkIndex: restore.focusedLinkIndex,
        restoreFragment: restore.fragment,
      });
      syncCssWarnings();
    } catch (error) {
      if (isFetchAborted(error)) {
        loading.hide();
        if (generation === loadGeneration) {
          breadcrumb.update(formatLoadCancelledBreadcrumb(renderer.width));
          if (keepCurrentPageVisible && session) {
            session.attach();
          }
        }
        return;
      }
      if (generation !== loadGeneration) return;
      throw error;
    } finally {
      cancelKeyboard.offKeyPress(onLoadingKey);
      if (loadAbortController === abortController) {
        loadAbortController = null;
      }
    }
  };

  renderer.on(CliRenderEvents.RESIZE, relayoutCurrentPage);

  breadcrumb.bar.onMouseUp = (event) => {
    if (helpVisible || openPrompt.active || search.promptActive || historyPicker.active) return;
    if (event.button !== 0 || event.type !== "up") return;
    if (history.entries.length === 0) return;

    const column = Math.trunc(event.x) - 1;
    const layout = layoutBreadcrumb(history, historyBreadcrumbWidth());
    const target = historyTargetAtBreadcrumbColumn(layout, column);

    if (target === "picker") {
      openHistoryPicker();
      return;
    }

    if (typeof target === "number") {
      void navigateToHistoryIndex(target);
      return;
    }

    if (history.entries.length > 1) {
      openHistoryPicker();
    }
  };

  const initial = splitPageLocation(process.argv[2] ?? DEFAULT_PAGE);
  await loadPage(
    initial.location || DEFAULT_PAGE,
    "push",
    initial.fragment,
  );
  if (loadedPage) {
    openPromptHistory.add(loadedPage.pageLocation);
  }

  startRendererOnce();
}

await main();
