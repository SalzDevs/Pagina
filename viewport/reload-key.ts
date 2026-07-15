import type { KeyEvent } from "@opentui/core";

export type ReloadKeyAction = "soft" | "hard";

/** Handle page reload keys. */
export function handleReloadKey(key: KeyEvent): ReloadKeyAction | null {
  if (key.eventType === "release") return null;
  if (key.meta) return null;

  const lower = key.name.toLowerCase();
  if (lower !== "r") return null;

  if (key.ctrl) return "hard";
  if (key.shift || key.name === "R") return "hard";
  return "soft";
}
