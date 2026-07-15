import { describe, expect, test } from "bun:test";

import { handleCopyUrlKey } from "../viewport/copy-url-key";

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

describe("handleCopyUrlKey", () => {
  test("binds y to the page URL", () => {
    expect(handleCopyUrlKey(key("y"))).toBe("url");
  });

  test("binds shift+y to a detailed URL with context", () => {
    expect(handleCopyUrlKey(key("y", { shift: true }))).toBe("detailed");
    expect(handleCopyUrlKey(key("Y"))).toBe("detailed");
  });

  test("ignores unrelated keys", () => {
    expect(handleCopyUrlKey(key("u"))).toBeNull();
    expect(handleCopyUrlKey(key("y", { ctrl: true }))).toBeNull();
    expect(handleCopyUrlKey(key("y", { meta: true }))).toBeNull();
  });
});
