import { createCliRenderer } from "@opentui/core";

import { collectLinks } from "./links/collect";
import { layout } from "./layout/layout";
import { loadHtml } from "./navigation/load";
import { normalizePageLocation } from "./navigation/location";
import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { paint } from "./paint/paint";
import { computeStyles } from "./style/style";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { measureContentHeight } from "./viewport/visible";

const DEFAULT_PAGE = "examples/page.html";

async function main() {
  const initialLocation = normalizePageLocation(process.argv[2] ?? DEFAULT_PAGE);

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  let session: BrowserSession | null = null;
  let currentLocation = initialLocation;

  const loadPage = async (location: string) => {
    session?.destroy();

    currentLocation = normalizePageLocation(location);
    const html = await loadHtml(currentLocation);

    const document = parseHTML(html);
    const dom = convert(document);
    const styled = await computeStyles(dom, { pageLocation: currentLocation });

    layout(styled, {
      viewport: {
        width: renderer.width,
        height: renderer.height,
      },
    });

    const displayList = paint(styled);
    const links = collectLinks(styled);
    const contentHeight = measureContentHeight(styled);

    session = createBrowserSession(renderer, displayList, contentHeight, links, {
      pageLocation: currentLocation,
      onNavigate: loadPage,
    });

    session.attach();
  };

  await loadPage(initialLocation);
  renderer.start();
}

await main();
