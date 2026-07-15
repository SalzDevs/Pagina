import type { KeyEvent } from "@opentui/core";

import { splitPageLocation } from "../navigation/fragment";
import type { BookmarkStore } from "../config/bookmarks";
import type { OpenPromptHistory } from "./open-prompt-history";
import { OpenPromptHistory as OpenPromptHistoryClass } from "./open-prompt-history";
import { completeLocalPath, expandTilde } from "./open-prompt-path";

export interface OpenPromptState {
  active: boolean;
  value: string;
  cursor: number;
  historyPosition: number;
  historyDraft: string;
}

export interface OpenPromptContext {
  history: OpenPromptHistory;
  bookmarks?: BookmarkStore;
  cwd?: string;
}

export type OpenPromptKeyResult =
  | { kind: "none" }
  | { kind: "open"; state: OpenPromptState }
  | { kind: "update"; state: OpenPromptState }
  | { kind: "submit"; location: string; fragment: string | null }
  | { kind: "cancel" };

export function createOpenPromptState(): OpenPromptState {
  return {
    active: false,
    value: "",
    cursor: 0,
    historyPosition: 0,
    historyDraft: "",
  };
}

/** Activate the prompt with an empty line at the end of history. */
export function activateOpenPrompt(history: OpenPromptHistory): OpenPromptState {
  return {
    active: true,
    value: "",
    cursor: 0,
    historyPosition: history.length,
    historyDraft: "",
  };
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
export function formatOpenPromptBreadcrumb(
  value: string,
  width: number,
  cursor = value.length,
): string {
  const prefix = "Open: ";
  const maxContentWidth = Math.max(0, width - prefix.length);
  const clampedCursor = Math.max(0, Math.min(cursor, value.length));
  const content = formatPromptContent(value, clampedCursor, maxContentWidth);

  return `${prefix}${content}`;
}

function formatPromptContent(value: string, cursor: number, maxWidth: number): string {
  const withCursor = `${value.slice(0, cursor)}_${value.slice(cursor)}`;

  if (withCursor.length <= maxWidth) return withCursor;
  if (maxWidth <= 1) return withCursor.slice(-maxWidth);

  if (cursor >= value.length) {
    const tail = withCursor.slice(-Math.max(1, maxWidth - 3));
    return `...${tail}`;
  }

  const room = maxWidth - 1;
  let start = Math.max(0, cursor - Math.floor(room / 2));
  let end = start + maxWidth;

  if (end > withCursor.length) {
    end = withCursor.length;
    start = Math.max(0, end - maxWidth);
  }

  let slice = withCursor.slice(start, end);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < withCursor.length ? "..." : "";

  const available = maxWidth - prefix.length - suffix.length;
  if (slice.length > available) {
    slice = slice.slice(0, available);
  }

  return `${prefix}${slice}${suffix}`;
}

function printableCharacter(key: KeyEvent): string | null {
  if (key.option) return null;
  if (key.name === "space") return " ";
  if (key.name.length === 1) return key.name;
  return null;
}

function pasteText(key: KeyEvent): string | null {
  const bracketed = key.sequence.match(/^\x1b\[200~([\s\S]*)\x1b\[201~$/);
  if (bracketed) return bracketed[1] ?? null;
  if (key.name === "paste") return key.sequence;
  return null;
}

function resetHistoryBrowse(state: OpenPromptState, history: OpenPromptHistory): OpenPromptState {
  return {
    ...state,
    historyPosition: history.length,
    historyDraft: "",
  };
}

function updatePrompt(
  state: OpenPromptState,
  history: OpenPromptHistory,
  value: string,
  cursor: number,
): OpenPromptState {
  return resetHistoryBrowse(
    {
      ...state,
      value,
      cursor: Math.max(0, Math.min(cursor, value.length)),
    },
    history,
  );
}

function insertText(
  state: OpenPromptState,
  history: OpenPromptHistory,
  text: string,
): OpenPromptState {
  const sanitized = text.replace(/[\r\n\t]/g, " ");
  const before = state.value.slice(0, state.cursor);
  const after = state.value.slice(state.cursor);
  const value = before + sanitized + after;

  return updatePrompt(state, history, value, state.cursor + sanitized.length);
}

function deleteBeforeCursor(state: OpenPromptState, history: OpenPromptHistory): OpenPromptState {
  if (state.cursor === 0) return state;

  const value = state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor);
  return updatePrompt(state, history, value, state.cursor - 1);
}

function deleteAfterCursor(state: OpenPromptState, history: OpenPromptHistory): OpenPromptState {
  if (state.cursor >= state.value.length) return state;

  const value = state.value.slice(0, state.cursor) + state.value.slice(state.cursor + 1);
  return updatePrompt(state, history, value, state.cursor);
}

function deleteWordBeforeCursor(state: OpenPromptState, history: OpenPromptHistory): OpenPromptState {
  if (state.cursor === 0) return state;

  let index = state.cursor;
  while (index > 0 && state.value[index - 1] === " ") index--;
  while (index > 0 && state.value[index - 1] !== " ") index--;

  const value = state.value.slice(0, index) + state.value.slice(state.cursor);
  return updatePrompt(state, history, value, index);
}

function moveCursor(state: OpenPromptState, cursor: number): OpenPromptState {
  return {
    ...state,
    cursor: Math.max(0, Math.min(cursor, state.value.length)),
  };
}

function browseHistory(
  state: OpenPromptState,
  history: OpenPromptHistory,
  direction: "up" | "down",
): OpenPromptState {
  if (history.length === 0) return state;

  if (direction === "up") {
    if (state.historyPosition === history.length) {
      const nextPosition = history.length - 1;
      return {
        ...state,
        historyDraft: state.value,
        historyPosition: nextPosition,
        value: history.get(nextPosition) ?? "",
        cursor: history.get(nextPosition)?.length ?? 0,
      };
    }

    if (state.historyPosition === 0) return state;

    const nextPosition = state.historyPosition - 1;
    const entry = history.get(nextPosition) ?? "";
    return {
      ...state,
      historyPosition: nextPosition,
      value: entry,
      cursor: entry.length,
    };
  }

  if (state.historyPosition === history.length) return state;

  const nextPosition = state.historyPosition + 1;
  if (nextPosition === history.length) {
    return {
      ...state,
      historyPosition: history.length,
      value: state.historyDraft,
      cursor: state.historyDraft.length,
    };
  }

  const entry = history.get(nextPosition) ?? "";
  return {
    ...state,
    historyPosition: nextPosition,
    value: entry,
    cursor: entry.length,
  };
}

function handleEditingShortcut(
  state: OpenPromptState,
  key: KeyEvent,
  history: OpenPromptHistory,
  context: OpenPromptContext,
): OpenPromptKeyResult | null {
  if (key.ctrl || key.meta) {
    const lower = key.name.toLowerCase();

    if (lower === "a") {
      return { kind: "update", state: moveCursor(state, 0) };
    }

    if (lower === "e") {
      return { kind: "update", state: moveCursor(state, state.value.length) };
    }

    if (lower === "u") {
      const value = state.value.slice(state.cursor);
      return {
        kind: "update",
        state: updatePrompt(state, history, value, 0),
      };
    }

    if (lower === "k") {
      const value = state.value.slice(0, state.cursor);
      return {
        kind: "update",
        state: updatePrompt(state, history, value, state.cursor),
      };
    }

    if (lower === "w") {
      return { kind: "update", state: deleteWordBeforeCursor(state, history) };
    }

    if (lower === "v") {
      const pasted = pasteText(key);
      if (pasted) {
        return { kind: "update", state: insertText(state, history, pasted) };
      }
    }

    return { kind: "none" };
  }

  switch (key.name) {
    case "left":
      return { kind: "update", state: moveCursor(state, state.cursor - 1) };
    case "right":
      return { kind: "update", state: moveCursor(state, state.cursor + 1) };
    case "home":
      return { kind: "update", state: moveCursor(state, 0) };
    case "end":
      return { kind: "update", state: moveCursor(state, state.value.length) };
    case "up":
      return { kind: "update", state: browseHistory(state, history, "up") };
    case "down":
      return { kind: "update", state: browseHistory(state, history, "down") };
    case "tab":
      if (key.shift) return { kind: "update", state };
      if (context?.bookmarks) {
        const bookmarkCompleted = context.bookmarks.completeToken(state.value, state.cursor);
        if (bookmarkCompleted) {
          return {
            kind: "update",
            state: updatePrompt(
              state,
              history,
              bookmarkCompleted.value,
              bookmarkCompleted.cursor,
            ),
          };
        }
      }
      const completed = completeLocalPath(state.value, state.cursor, context.cwd);
      if (!completed) return { kind: "update", state };
      return {
        kind: "update",
        state: updatePrompt(state, history, completed.value, completed.cursor),
      };
    case "backspace":
      return { kind: "update", state: deleteBeforeCursor(state, history) };
    case "delete":
      return { kind: "update", state: deleteAfterCursor(state, history) };
    default:
      return null;
  }
}

/** Apply a key event to the open prompt. Returns none when the prompt is inactive and the key is unrelated. */
export function applyOpenPromptKey(
  state: OpenPromptState,
  key: KeyEvent,
  context?: OpenPromptContext,
): OpenPromptKeyResult {
  if (key.eventType === "release") return { kind: "none" };

  if (!state.active) {
    if (key.ctrl || key.meta) return { kind: "none" };
    if (!isOpenPromptToggleKey(key)) return { kind: "none" };
    return {
      kind: "open",
      state: context ? activateOpenPrompt(context.history) : activateOpenPrompt(new OpenPromptHistoryClass()),
    };
  }

  const history = context?.history ?? new OpenPromptHistoryClass();

  if (key.name === "escape") {
    return { kind: "cancel" };
  }

  if (key.name === "return" || key.name === "enter") {
    const trimmed = state.value.trim();
    if (trimmed.length === 0) return { kind: "cancel" };

    if (trimmed.startsWith("@")) {
      const bookmark = context?.bookmarks?.resolveInput(trimmed);
      if (!bookmark) return { kind: "update", state };
      return {
        kind: "submit",
        location: bookmark.location,
        fragment: bookmark.fragment,
      };
    }

    const expanded = expandTilde(trimmed);
    const parts = splitPageLocation(expanded);
    if (parts.location.length === 0) return { kind: "cancel" };

    return {
      kind: "submit",
      location: parts.location,
      fragment: parts.fragment,
    };
  }

  const shortcut = handleEditingShortcut(state, key, history, context ?? { history });
  if (shortcut) return shortcut;

  if (key.ctrl || key.meta) return { kind: "none" };

  const pasted = pasteText(key);
  if (pasted) {
    return { kind: "update", state: insertText(state, history, pasted) };
  }

  const character = printableCharacter(key);
  if (character) {
    return { kind: "update", state: insertText(state, history, character) };
  }

  return { kind: "update", state };
}
