import type { KeyEvent } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";
import { isTextCommand } from "../paint/display-list";

export interface SearchMatch {
  commandIndex: number;
  start: number;
  length: number;
  y: number;
  x: number;
}

export interface SearchState {
  promptActive: boolean;
  value: string;
  cursor: number;
  query: string;
  matchIndex: number;
}

export type SearchKeyResult =
  | { kind: "none" }
  | { kind: "open"; state: SearchState }
  | { kind: "update"; state: SearchState }
  | { kind: "submit"; state: SearchState }
  | { kind: "cancel" }
  | { kind: "navigate"; state: SearchState; direction: "next" | "previous" };

export function createSearchState(): SearchState {
  return {
    promptActive: false,
    value: "",
    cursor: 0,
    query: "",
    matchIndex: 0,
  };
}

export function activateSearchPrompt(state: SearchState): SearchState {
  return {
    ...state,
    promptActive: true,
    value: state.query,
    cursor: state.query.length,
  };
}

/** True when the key opens the in-page search prompt. */
export function isSearchToggleKey(key: KeyEvent): boolean {
  if (key.eventType === "release") return false;

  if (key.ctrl && key.name === "f") return true;

  return !key.ctrl && !key.meta && (key.name === "/" || key.sequence === "/");
}

/** True when the key moves to the next or previous search match. */
export function isSearchNavigateKey(key: KeyEvent): boolean {
  if (key.eventType === "release") return false;
  if (key.ctrl || key.meta) return false;
  return key.name === "n";
}

export function searchNavigateDirection(key: KeyEvent): "next" | "previous" | null {
  if (!isSearchNavigateKey(key)) return null;
  return key.shift ? "previous" : "next";
}

/** Find every case-insensitive substring match in the display list. */
export function findSearchMatches(displayList: DisplayList, query: string): SearchMatch[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const needle = trimmed.toLowerCase();
  const matches: SearchMatch[] = [];

  for (let commandIndex = 0; commandIndex < displayList.length; commandIndex++) {
    const command = displayList[commandIndex];
    if (!command || !isTextCommand(command) || command.text.length === 0) continue;

    const haystack = command.text.toLowerCase();
    let start = 0;

    while (start < haystack.length) {
      const index = haystack.indexOf(needle, start);
      if (index === -1) break;

      matches.push({
        commandIndex,
        start: index,
        length: needle.length,
        y: command.y,
        x: command.x + index,
      });

      start = index + needle.length;
    }
  }

  return matches;
}

export function matchCommandIndices(matches: SearchMatch[]): Set<number> {
  return new Set(matches.map((match) => match.commandIndex));
}

export function clampSearchMatchIndex(matchIndex: number, matchCount: number): number {
  if (matchCount <= 0) return 0;
  return ((matchIndex % matchCount) + matchCount) % matchCount;
}

export function stepSearchMatchIndex(
  matchIndex: number,
  matchCount: number,
  direction: "next" | "previous",
): number {
  if (matchCount <= 0) return 0;
  const delta = direction === "next" ? 1 : -1;
  return clampSearchMatchIndex(matchIndex + delta, matchCount);
}

/** Format the breadcrumb line while the search prompt is active. */
export function formatSearchPromptBreadcrumb(
  value: string,
  width: number,
  cursor = value.length,
): string {
  const prefix = "Search: ";
  const maxContentWidth = Math.max(0, width - prefix.length);
  const clampedCursor = Math.max(0, Math.min(cursor, value.length));
  const content = formatPromptContent(value, clampedCursor, maxContentWidth);

  return `${prefix}${content}`;
}

/** Format a compact search status suffix for the breadcrumb bar. */
export function formatSearchStatus(
  query: string,
  matchIndex: number,
  matchCount: number,
  width: number,
): string {
  if (matchCount === 0) {
    const variants = [` | 🔍 "${query}" not found`, " | 🔍 no matches", " | 🔍"];
    for (const status of variants) {
      if (status.length <= width) return status;
    }
    return variants[variants.length - 1]!;
  }

  const current = matchIndex + 1;
  const variants = [` | 🔍 ${current}/${matchCount}`, " | 🔍"];
  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return variants[variants.length - 1]!;
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

function updatePrompt(state: SearchState, value: string, cursor: number): SearchState {
  return {
    ...state,
    value,
    cursor: Math.max(0, Math.min(cursor, value.length)),
  };
}

function insertText(state: SearchState, text: string): SearchState {
  const sanitized = text.replace(/[\r\n\t]/g, " ");
  const before = state.value.slice(0, state.cursor);
  const after = state.value.slice(state.cursor);
  const value = before + sanitized + after;

  return updatePrompt(state, value, state.cursor + sanitized.length);
}

function deleteBeforeCursor(state: SearchState): SearchState {
  if (state.cursor === 0) return state;

  const value = state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor);
  return updatePrompt(state, value, state.cursor - 1);
}

function deleteAfterCursor(state: SearchState): SearchState {
  if (state.cursor >= state.value.length) return state;

  const value = state.value.slice(0, state.cursor) + state.value.slice(state.cursor + 1);
  return updatePrompt(state, value, state.cursor);
}

function moveCursor(state: SearchState, cursor: number): SearchState {
  return {
    ...state,
    cursor: Math.max(0, Math.min(cursor, state.value.length)),
  };
}

function handleEditingShortcut(state: SearchState, key: KeyEvent): SearchKeyResult | null {
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
      return { kind: "update", state: updatePrompt(state, value, 0) };
    }

    if (lower === "k") {
      const value = state.value.slice(0, state.cursor);
      return { kind: "update", state: updatePrompt(state, value, state.cursor) };
    }

    if (lower === "v") {
      const pasted = pasteText(key);
      if (pasted) {
        return { kind: "update", state: insertText(state, pasted) };
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
    case "backspace":
      return { kind: "update", state: deleteBeforeCursor(state) };
    case "delete":
      return { kind: "update", state: deleteAfterCursor(state) };
    default:
      return null;
  }
}

/** Apply a key event to the in-page search UI. */
export function applySearchKey(state: SearchState, key: KeyEvent): SearchKeyResult {
  if (key.eventType === "release") return { kind: "none" };

  if (!state.promptActive) {
    const direction = searchNavigateDirection(key);
    if (direction && state.query.length > 0) {
      return { kind: "navigate", state, direction };
    }

    if (!isSearchToggleKey(key)) return { kind: "none" };
    return { kind: "open", state: activateSearchPrompt(state) };
  }

  if (key.name === "escape") {
    return { kind: "cancel" };
  }

  if (key.name === "return" || key.name === "enter") {
    const trimmed = state.value.trim();
    if (trimmed.length === 0) return { kind: "cancel" };

    return {
      kind: "submit",
      state: {
        ...state,
        promptActive: false,
        query: trimmed,
        matchIndex: 0,
      },
    };
  }

  const shortcut = handleEditingShortcut(state, key);
  if (shortcut) return shortcut;

  if (key.ctrl || key.meta) return { kind: "none" };

  const pasted = pasteText(key);
  if (pasted) {
    return { kind: "update", state: insertText(state, pasted) };
  }

  const character = printableCharacter(key);
  if (character) {
    return { kind: "update", state: insertText(state, character) };
  }

  return { kind: "update", state };
}
