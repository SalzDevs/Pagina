import type { KeyEvent } from "@opentui/core";

/** True when the key toggles the in-app help overlay. */
export function isHelpToggleKey(key: KeyEvent): boolean {
  return key.eventType !== "release" && key.name === "?" && !key.ctrl && !key.meta;
}
