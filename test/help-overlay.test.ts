import { describe, expect, test } from "bun:test";

import { BREADCRUMB_HEIGHT } from "../render/breadcrumb";
import { mountHelpOverlay } from "../render/help-overlay";
import { createTestRenderer } from "./helpers/test-renderer";

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

describe("help overlay", () => {
  test("reports scrollability when content exceeds the panel", () => {
    const renderer = createTestRenderer(80, 10);
    const overlay = mountHelpOverlay(renderer);

    overlay.resize(80, 10);
    expect(overlay.isScrollable()).toBe(true);

    overlay.resize(80, 40);
    expect(overlay.isScrollable()).toBe(false);

    overlay.destroy();
    renderer.destroy();
  });

  test("scrolls help content with movement keys", () => {
    const renderer = createTestRenderer(80, BREADCRUMB_HEIGHT + 5);
    const overlay = mountHelpOverlay(renderer);

    overlay.resize(80, BREADCRUMB_HEIGHT + 5);
    overlay.setVisible(true);

    expect(overlay.handleKey(key("j"))).toBe(true);
    expect(overlay.handleKey(key("g"))).toBe(true);
    expect(overlay.handleKey(key("?"))).toBe(false);

    overlay.destroy();
    renderer.destroy();
  });

  test("includes css warnings without losing the close hint", () => {
    const renderer = createTestRenderer(80, 12);
    const overlay = mountHelpOverlay(renderer);

    overlay.setCssWarnings(["https://example.com/theme.css"]);
    overlay.resize(80, 12);
    overlay.setVisible(true);

    expect(overlay.isScrollable()).toBe(true);

    overlay.destroy();
    renderer.destroy();
  });
});
