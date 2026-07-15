import type { KeyEvent } from "@opentui/core";

export type CopyUrlKeyAction = "url" | "detailed";

/** Handle copy-current-URL keys. */
export function handleCopyUrlKey(key: KeyEvent): CopyUrlKeyAction | null {
  if (key.eventType === "release") return null;
  if (key.meta || key.ctrl) return null;

  const lower = key.name.toLowerCase();
  if (lower !== "y") return null;

  if (key.shift || key.name === "Y") return "detailed";
  return "url";
}
