import { createCliRenderer } from "@opentui/core";

import { collectLinks } from "./links/collect";
import { layout } from "./layout/layout";
import { loadHtml } from "./navigation/load";
import {
  createBrowserHistory,
  extractPageTitle,
  formatBreadcrumb,
  goBack,
  goForward,
  historyLabel,
  pushHistory,
  type BrowserHistory,
} from "./navigation/history";
import { normalizePageLocation } from "./navigation/location";
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
    session?.destroy();

    const pageLocation = normalizePageLocation(location);
    const html = await loadHtml(pageLocation);

    const document = parseHTML(html);
    const dom = convert(document);
    const styled = await computeStyles(dom, { pageLocation });

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
        label: historyLabel(pageLocation, extractPageTitle(dom)),
      });
    }

    breadcrumb.update(formatBreadcrumb(history, renderer.width));

    session = createBrowserSession(renderer, displayList, contentHeight, links, {
      pageLocation,
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
  renderer.start();
}

await main();
