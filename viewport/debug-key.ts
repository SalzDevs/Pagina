import type { KeyEvent } from "@opentui/core";

/** True when the key toggles the page debug overlay. */
export function isDebugToggleKey(key: KeyEvent): boolean {
  return key.eventType !== "release" && key.name === "v" && !key.ctrl && !key.meta && !key.shift;
}
