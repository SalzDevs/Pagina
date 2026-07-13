import { CliRenderEvents, createCliRenderer } from "@opentui/core";

import { loadHtml } from "./navigation/load";
import { buildErrorPageHtml } from "./navigation/error-page";
import {
  createBrowserHistory,
  extractPageTitle,
  formatBreadcrumb,
  formatLoadingBreadcrumb,
  goBack,
  goForward,
  historyEntryLabel,
  pushHistory,
  type BrowserHistory,
} from "./navigation/history";
import { normalizePageLocation } from "./navigation/location";
import { resolveDocumentBase } from "./navigation/base-url";
import { splitPageLocation } from "./navigation/fragment";
import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { BREADCRUMB_HEIGHT, mountBreadcrumb } from "./render/breadcrumb";
import type { MountLayout } from "./render/render";
import { computeStyles, type StyledNode } from "./style/style";
import { buildPageView } from "./viewport/page-view";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { clampScrollY } from "./viewport/scroll";

const DEFAULT_PAGE = "examples/page.html";

type HistoryMode = "push" | "none";

interface LoadedPage {
  pageLocation: string;
  documentBase: string;
  styled: StyledNode;
}

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  const breadcrumb = mountBreadcrumb(renderer);
  let history: BrowserHistory = createBrowserHistory();
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

  const mountCurrentPage = (
    fragment: string | null = null,
    historyMode: HistoryMode = "none",
    pageTitle?: string,
    preserveViewState = false,
  ) => {
    if (!loadedPage) return;

    const previousScrollY = preserveViewState ? (session?.viewport.scrollY ?? 0) : 0;
    const previousFocusedLink = preserveViewState ? (session?.focusedLinkIndex ?? null) : null;

    session?.destroy();

    const chrome = contentLayout();
    breadcrumb.resize(renderer.width);

    const view = buildPageView(loadedPage.styled, {
      width: chrome.width,
      height: chrome.height,
    });

    if (historyMode === "push" && pageTitle !== undefined) {
      history = pushHistory(history, {
        location: loadedPage.pageLocation,
        label: historyEntryLabel(loadedPage.pageLocation, pageTitle),
      });
    }

    breadcrumb.update(formatBreadcrumb(history, renderer.width));

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
      onNavigate: (target, targetFragment) => loadPage(target, "push", targetFragment ?? null),
      onHistoryBack: async () => {
        const result = goBack(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none");
      },
      onHistoryForward: async () => {
        const result = goForward(history);
        history = result.history;
        if (!result.entry) return;
        await loadPage(result.entry.location, "none");
      },
    });

    if (fragment !== null) {
      session.scrollToFragment(fragment);
    }

    session.attach();
  };

  const relayoutCurrentPage = () => {
    if (!loadedPage || !session) return;
    mountCurrentPage(null, "none", undefined, true);
  };

  const loadPage = async (
    location: string,
    historyMode: HistoryMode = "push",
    fragment: string | null = null,
  ) => {
    const pageLocation = normalizePageLocation(location);
    breadcrumb.update(formatLoadingBreadcrumb(pageLocation, renderer.width));
    startRendererOnce();

    session?.destroy();
    session = null;

    let html: string;
    try {
      html = await loadHtml(pageLocation);
    } catch (error) {
      html = buildErrorPageHtml(pageLocation, error);
    }

    const document = parseHTML(html);
    const dom = convert(document);
    const documentBase = resolveDocumentBase(dom, pageLocation);
    const pageTitle = extractPageTitle(dom);
    const styled = await computeStyles(dom, { pageLocation, documentBase });

    loadedPage = {
      pageLocation,
      documentBase,
      styled,
    };

    mountCurrentPage(fragment, historyMode, pageTitle, false);
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
