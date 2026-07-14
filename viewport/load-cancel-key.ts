import type { KeyEvent } from "@opentui/core";

/** True when the key cancels an in-flight page load. */
export function isLoadCancelKey(key: KeyEvent): boolean {
  return key.eventType !== "release" && !key.ctrl && !key.meta && key.name === "escape";
}
