import { describe, expect, test } from "bun:test";

import { handleReloadKey } from "../viewport/reload-key";

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

describe("handleReloadKey", () => {
  test("binds r to soft reload", () => {
    expect(handleReloadKey(key("r"))).toBe("soft");
  });

  test("binds shift+r and ctrl+r to hard reload", () => {
    expect(handleReloadKey(key("r", { shift: true }))).toBe("hard");
    expect(handleReloadKey(key("R"))).toBe("hard");
    expect(handleReloadKey(key("r", { ctrl: true }))).toBe("hard");
  });

  test("ignores unrelated keys", () => {
    expect(handleReloadKey(key("u"))).toBeNull();
    expect(handleReloadKey(key("r", { meta: true }))).toBeNull();
  });
});
