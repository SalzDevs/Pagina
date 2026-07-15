import type { KeyEvent } from "@opentui/core";

import type { BrowserHistory } from "../navigation/history";

export interface HistoryPickerState {
  active: boolean;
  selectedIndex: number;
}

export type HistoryPickerKeyResult =
  | { kind: "none" }
  | { kind: "open"; state: HistoryPickerState }
  | { kind: "update"; state: HistoryPickerState }
  | { kind: "submit"; index: number }
  | { kind: "cancel" };

export function createHistoryPickerState(): HistoryPickerState {
  return {
    active: false,
    selectedIndex: 0,
  };
}

export function activateHistoryPicker(history: BrowserHistory): HistoryPickerState {
  return {
    active: true,
    selectedIndex: Math.max(0, history.index),
  };
}

/** True when the key opens the history picker. */
export function isHistoryPickerToggleKey(key: KeyEvent): boolean {
  return (
    key.eventType !== "release" &&
    !key.ctrl &&
    !key.meta &&
    key.name === "b"
  );
}

function clampSelection(selectedIndex: number, entryCount: number): number {
  if (entryCount <= 0) return 0;
  return Math.max(0, Math.min(selectedIndex, entryCount - 1));
}

function moveSelection(
  state: HistoryPickerState,
  history: BrowserHistory,
  selectedIndex: number,
): HistoryPickerState {
  return {
    ...state,
    selectedIndex: clampSelection(selectedIndex, history.entries.length),
  };
}

/** Format overlay lines for the history picker. */
export function formatHistoryPickerLines(
  history: BrowserHistory,
  width: number,
  selectedIndex: number,
): string[] {
  const title = "History — ↑/↓ to select, Enter to go, Esc to close";
  const lines = [title, ""];

  for (let index = 0; index < history.entries.length; index++) {
    const entry = history.entries[index]!;
    const marker = index === selectedIndex ? "› " : "  ";
    const current = index === history.index ? " (current)" : "";
    const label = `${marker}${entry.label}${current}`;
    lines.push(
      label.length <= width ? label : `${label.slice(0, Math.max(0, width - 3))}...`,
    );
  }

  return lines;
}

/** Apply a key event to the history picker. */
export function applyHistoryPickerKey(
  state: HistoryPickerState,
  key: KeyEvent,
  history: BrowserHistory,
): HistoryPickerKeyResult {
  if (key.eventType === "release") return { kind: "none" };

  if (!state.active) {
    if (!isHistoryPickerToggleKey(key)) return { kind: "none" };
    if (history.entries.length === 0) return { kind: "none" };
    return { kind: "open", state: activateHistoryPicker(history) };
  }

  if (key.name === "escape") {
    return { kind: "cancel" };
  }

  if (key.name === "return" || key.name === "enter") {
    return { kind: "submit", index: clampSelection(state.selectedIndex, history.entries.length) };
  }

  if (key.ctrl || key.meta) return { kind: "none" };

  switch (key.name) {
    case "up":
    case "k":
      return {
        kind: "update",
        state: moveSelection(state, history, state.selectedIndex - 1),
      };
    case "down":
    case "j":
      return {
        kind: "update",
        state: moveSelection(state, history, state.selectedIndex + 1),
      };
    case "home":
      return {
        kind: "update",
        state: moveSelection(state, history, 0),
      };
    case "end":
      return {
        kind: "update",
        state: moveSelection(state, history, history.entries.length - 1),
      };
    case "g":
      return {
        kind: "update",
        state: moveSelection(state, history, key.shift ? history.entries.length - 1 : 0),
      };
    default:
      return { kind: "none" };
  }
}
