import { createCliRenderer } from "@opentui/core";

import { collectLinks } from "./links/collect";
import { layout } from "./layout/layout";
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
import { collectFragmentPositions } from "./navigation/anchors";
import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { paint } from "./paint/paint";
import { BREADCRUMB_HEIGHT, mountBreadcrumb } from "./render/breadcrumb";
import { computeStyles } from "./style/style";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { measureContentHeight, measureDisplayListHeight } from "./viewport/visible";

const DEFAULT_PAGE = "examples/page.html";

type HistoryMode = "push" | "none";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  const breadcrumb = mountBreadcrumb(renderer);
  let history: BrowserHistory = createBrowserHistory();
  let session: BrowserSession | null = null;
  let rendererStarted = false;

  const startRendererOnce = () => {
    if (rendererStarted) return;
    renderer.start();
    rendererStarted = true;
  };

  const contentLayout = () => ({
    top: BREADCRUMB_HEIGHT,
    width: renderer.width,
    height: Math.max(1, renderer.height - BREADCRUMB_HEIGHT),
  });

  const loadPage = async (
    location: string,
    historyMode: HistoryMode = "push",
    fragment: string | null = null,
  ) => {
    const pageLocation = normalizePageLocation(location);
    breadcrumb.update(formatLoadingBreadcrumb(pageLocation, renderer.width));
    startRendererOnce();

    session?.destroy();

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

    const chrome = contentLayout();
    layout(styled, {
      viewport: {
        width: chrome.width,
        height: chrome.height,
      },
    });

    const displayList = paint(styled, { viewportHeight: chrome.height });
    const links = collectLinks(styled);
    const fragmentPositions = collectFragmentPositions(styled);
    const contentHeight = Math.max(
      measureContentHeight(styled),
      measureDisplayListHeight(displayList),
    );

    if (historyMode === "push") {
      history = pushHistory(history, {
        location: pageLocation,
        label: historyEntryLabel(pageLocation, pageTitle),
      });
    }

    breadcrumb.update(formatBreadcrumb(history, renderer.width));

    session = createBrowserSession(renderer, displayList, contentHeight, links, {
      pageLocation,
      documentBase,
      layout: chrome,
      fragmentPositions,
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

  const initial = splitPageLocation(process.argv[2] ?? DEFAULT_PAGE);
  await loadPage(
    initial.location || DEFAULT_PAGE,
    "push",
    initial.fragment,
  );

  startRendererOnce();
}

await main();
