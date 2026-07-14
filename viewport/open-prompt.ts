import type { KeyEvent } from "@opentui/core";

import { splitPageLocation } from "../navigation/fragment";

export interface OpenPromptState {
  active: boolean;
  value: string;
}

export type OpenPromptKeyResult =
  | { kind: "none" }
  | { kind: "open" }
  | { kind: "update"; state: OpenPromptState }
  | { kind: "submit"; location: string; fragment: string | null }
  | { kind: "cancel" };

export function createOpenPromptState(): OpenPromptState {
  return { active: false, value: "" };
}

/** True when the key opens the in-app location prompt. */
export function isOpenPromptToggleKey(key: KeyEvent): boolean {
  return (
    key.eventType !== "release" &&
    !key.ctrl &&
    !key.meta &&
    (key.name === ":" || key.sequence === ":")
  );
}

/** Format the breadcrumb line while the open prompt is active. */
export function formatOpenPromptBreadcrumb(value: string, width: number): string {
  const prefix = "Open: ";
  const cursor = "_";
  const line = `${prefix}${value}${cursor}`;

  if (line.length <= width) return line;

  const tailRoom = Math.max(0, width - prefix.length - cursor.length - 3);
  const tail = value.slice(-tailRoom);
  return `${prefix}...${tail}${cursor}`;
}

function printableCharacter(key: KeyEvent): string | null {
  if (key.option) return null;
  if (key.name === "space") return " ";
  if (key.name.length === 1) return key.name;
  return null;
}

/** Apply a key event to the open prompt. Returns none when the prompt is inactive and the key is unrelated. */
export function applyOpenPromptKey(
  state: OpenPromptState,
  key: KeyEvent,
): OpenPromptKeyResult {
  if (key.eventType === "release") return { kind: "none" };
  if (key.ctrl || key.meta) return { kind: "none" };

  if (!state.active) {
    return isOpenPromptToggleKey(key) ? { kind: "open" } : { kind: "none" };
  }

  if (key.name === "escape") {
    return { kind: "cancel" };
  }

  if (key.name === "return" || key.name === "enter") {
    const trimmed = state.value.trim();
    if (trimmed.length === 0) return { kind: "cancel" };

    const parts = splitPageLocation(trimmed);
    if (parts.location.length === 0) return { kind: "cancel" };

    return {
      kind: "submit",
      location: parts.location,
      fragment: parts.fragment,
    };
  }

  if (key.name === "backspace" || key.name === "delete") {
    if (state.value.length === 0) {
      return { kind: "update", state };
    }

    return {
      kind: "update",
      state: { ...state, value: state.value.slice(0, -1) },
    };
  }

  const character = printableCharacter(key);
  if (character) {
    return {
      kind: "update",
      state: { ...state, value: state.value + character },
    };
  }

  return { kind: "update", state };
}
