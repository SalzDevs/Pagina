import { describe, expect, test } from "bun:test";

import { isLoadCancelKey } from "../viewport/load-cancel-key";

describe("isLoadCancelKey", () => {
  test("matches Escape without modifiers", () => {
    expect(
      isLoadCancelKey({
        name: "escape",
        eventType: "press",
        ctrl: false,
        meta: false,
      } as import("@opentui/core").KeyEvent),
    ).toBe(true);
  });

  test("ignores release events and modified Escape", () => {
    expect(
      isLoadCancelKey({
        name: "escape",
        eventType: "release",
        ctrl: false,
        meta: false,
      } as import("@opentui/core").KeyEvent),
    ).toBe(false);
    expect(
      isLoadCancelKey({
        name: "escape",
        eventType: "press",
        ctrl: true,
        meta: false,
      } as import("@opentui/core").KeyEvent),
    ).toBe(false);
  });
});
