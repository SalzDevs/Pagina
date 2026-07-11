import { createCliRenderer } from "@opentui/core";

import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { layout } from "./layout/layout";
import { loadHtmlFromFile } from "./navigation/load";
import { paint } from "./paint/paint";
import { computeStyles } from "./style/style";
import { createScrollSession } from "./viewport/session";
import { measureContentHeight } from "./viewport/visible";

const DEFAULT_PAGE = "examples/page.html";

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_PAGE;
  const html = await loadHtmlFromFile(filePath);

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  const document = parseHTML(html);
  const dom = convert(document);
  const styled = computeStyles(dom);

  layout(styled, {
    viewport: {
      width: renderer.width,
      height: renderer.height,
    },
  });

  const displayList = paint(styled);
  const contentHeight = measureContentHeight(displayList);
  const session = createScrollSession(renderer, displayList, contentHeight);

  session.rerender();
  session.attach();
  renderer.start();
}

await main();
