import { describe, expect, test } from "bun:test";

import { isDebugToggleKey } from "../viewport/debug-key";

function key(
  name: string,
  options: { shift?: boolean; ctrl?: boolean; meta?: boolean } = {},
) {
  return {
    name,
    eventType: "press" as const,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
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

describe("isDebugToggleKey", () => {
  test("matches v without modifiers", () => {
    expect(isDebugToggleKey(key("v"))).toBe(true);
  });

  test("ignores modified or unrelated keys", () => {
    expect(isDebugToggleKey(key("V", { shift: true }))).toBe(false);
    expect(isDebugToggleKey(key("v", { ctrl: true }))).toBe(false);
    expect(isDebugToggleKey(key("u"))).toBe(false);
  });
});
