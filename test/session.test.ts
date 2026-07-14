import { describe, expect, test } from "bun:test";

import { loadPageContent } from "../navigation/load-page";
import { BREADCRUMB_HEIGHT } from "../render/breadcrumb";
import { buildPageView } from "../viewport/page-view";
import { createBrowserSession } from "../viewport/session";
import { createTestRenderer } from "./helpers/test-renderer";

describe("browser session", () => {
  test("suspend keeps the mounted page visible until destroy", async () => {
    const renderer = createTestRenderer();
    const page = await loadPageContent("examples/page.html");
    const layout = { top: BREADCRUMB_HEIGHT, width: 80, height: 20 };
    const view = buildPageView(page.styled, { width: layout.width, height: layout.height });

    const session = createBrowserSession(
      renderer,
      view.displayList,
      view.contentHeight,
      view.links,
      {
        pageLocation: page.pageLocation,
        documentBase: page.documentBase,
        layout,
        fragmentPositions: view.fragmentPositions,
        onNavigate: () => {},
      },
    );

    expect(renderer.root.getChildren()).toHaveLength(1);

    session.attach();
    session.suspend();
    expect(renderer.root.getChildren()).toHaveLength(1);

    session.destroy();
    expect(renderer.root.getChildren()).toHaveLength(0);

    renderer.destroy();
  });
});
