import type { KeyEvent } from "@opentui/core";

export type HistoryKeyAction = "back" | "forward";

/** Handle history navigation keys. */
export function handleHistoryKey(key: KeyEvent): HistoryKeyAction | null {
  if (key.eventType === "release") return null;

  if (key.name === "u" && key.shift) return "forward";
  if (key.name === "u" && !key.shift && !key.ctrl && !key.meta) return "back";

  if (key.option || key.meta) {
    if (key.name === "left") return "back";
    if (key.name === "right") return "forward";
  }

  return null;
}
