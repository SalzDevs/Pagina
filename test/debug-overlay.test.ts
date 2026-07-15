import { describe, expect, test } from "bun:test";

import { BREADCRUMB_HEIGHT } from "../render/breadcrumb";
import { mountDebugOverlay } from "../render/debug-overlay";
import { createTestRenderer } from "./helpers/test-renderer";
import { loadPageContent } from "../navigation/load-page";

function key(name: string) {
  return {
    name,
    eventType: "press" as const,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: name,
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

describe("debug overlay", () => {
  test("reports scrollability when debug content exceeds the panel", async () => {
    const renderer = createTestRenderer(80, 10);
    const overlay = mountDebugOverlay(renderer);
    const page = await loadPageContent("examples/page.html", { viewportWidth: 80 });

    overlay.setContext({ page });
    overlay.resize(80, 10);
    expect(overlay.isScrollable()).toBe(true);

    overlay.resize(80, 80);
    expect(overlay.isScrollable()).toBe(false);

    overlay.destroy();
    renderer.destroy();
  });

  test("scrolls debug content with movement keys", async () => {
    const renderer = createTestRenderer(80, BREADCRUMB_HEIGHT + 5);
    const overlay = mountDebugOverlay(renderer);
    const page = await loadPageContent("examples/page.html", { viewportWidth: 80 });

    overlay.setContext({ page });
    overlay.resize(80, BREADCRUMB_HEIGHT + 5);
    overlay.setVisible(true);

    expect(overlay.handleKey(key("j"))).toBe(true);
    expect(overlay.handleKey(key("g"))).toBe(true);
    expect(overlay.handleKey(key("v"))).toBe(false);

    overlay.destroy();
    renderer.destroy();
  });
});
