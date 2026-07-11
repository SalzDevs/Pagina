import { resolve } from "node:path";

import { createCliRenderer } from "@opentui/core";

import { collectLinks } from "./links/collect";
import { layout } from "./layout/layout";
import { loadHtmlFromFile } from "./navigation/load";
import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { paint } from "./paint/paint";
import { computeStyles } from "./style/style";
import { createBrowserSession, type BrowserSession } from "./viewport/session";
import { measureContentHeight } from "./viewport/visible";

const DEFAULT_PAGE = "examples/page.html";

async function main() {
  const initialPath = resolve(process.argv[2] ?? DEFAULT_PAGE);

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  let session: BrowserSession | null = null;
  let currentPath = initialPath;

  const loadPage = async (filePath: string) => {
    session?.destroy();

    currentPath = resolve(filePath);
    const html = await loadHtmlFromFile(currentPath);

    const document = parseHTML(html);
    const dom = convert(document);
    const styled = await computeStyles(dom, { basePath: currentPath });

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
      basePath: currentPath,
      onNavigate: loadPage,
    });

    session.attach();
  };

  await loadPage(initialPath);
  renderer.start();
}

await main();
