import { describe, expect, test } from "bun:test";

import {
  applyOpenPromptKey,
  createOpenPromptState,
  formatOpenPromptBreadcrumb,
  isOpenPromptToggleKey,
} from "../viewport/open-prompt";

function key(
  name: string,
  options: { shift?: boolean; ctrl?: boolean; sequence?: string } = {},
) {
  return {
    name,
    eventType: "press" as const,
    ctrl: options.ctrl ?? false,
    meta: false,
    shift: options.shift ?? false,
    option: false,
    sequence: options.sequence ?? name,
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

describe("open prompt", () => {
  test("opens on colon", () => {
    expect(isOpenPromptToggleKey(key(":"))).toBe(true);
    expect(isOpenPromptToggleKey(key("j"))).toBe(false);

    const result = applyOpenPromptKey(createOpenPromptState(), key(":"));
    expect(result).toEqual({ kind: "open" });
  });

  test("accepts typed input and submits a location with fragment", () => {
    let state = createOpenPromptState();
    state = { active: true, value: "" };

    state = applyTyped(state, "e", "x", "a", "m", "p", "l", "e", "s", "/", "p", "a", "g", "e", ".", "h", "t", "m", "l", "#", "i", "n", "t", "r", "o");
    const submit = applyOpenPromptKey(state, key("return"));

    expect(submit).toEqual({
      kind: "submit",
      location: "examples/page.html",
      fragment: "intro",
    });
  });

  test("cancels on escape or empty submit", () => {
    let state: ReturnType<typeof createOpenPromptState> = { active: true, value: "  " };

    expect(applyOpenPromptKey(state, key("escape"))).toEqual({ kind: "cancel" });
    expect(applyOpenPromptKey(state, key("return"))).toEqual({ kind: "cancel" });
  });

  test("deletes characters with backspace", () => {
    let state = { active: true, value: "ab" };
    const result = applyOpenPromptKey(state, key("backspace"));

    expect(result).toEqual({
      kind: "update",
      state: { active: true, value: "a" },
    });
  });

  test("formats the breadcrumb prompt line and truncates long input", () => {
    expect(formatOpenPromptBreadcrumb("examples/page.html", 40)).toBe(
      "Open: examples/page.html_",
    );

    const line = formatOpenPromptBreadcrumb(
      "https://example.com/very/long/path/to/a/page.html",
      24,
    );
    expect(line.length).toBeLessThanOrEqual(24);
    expect(line.startsWith("Open: ...")).toBe(true);
    expect(line.endsWith("_")).toBe(true);
  });
});

function applyTyped(
  state: ReturnType<typeof createOpenPromptState>,
  ...chars: string[]
) {
  let next = state;
  for (const char of chars) {
    const result = applyOpenPromptKey(next, key(char));
    if (result.kind !== "update") {
      throw new Error(`Expected update while typing ${char}`);
    }
    next = result.state;
  }
  return next;
}
