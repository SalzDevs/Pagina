import type { KeyEvent } from "@opentui/core";

import type { DisplayCommand } from "../paint/display-list";
import type { ScrollViewport } from "../viewport/scroll";
import { scrollTo } from "../viewport/scroll";
import type { Link } from "./types";

export const FOCUSED_LINK_FG = "#ffffff";
export const FOCUSED_LINK_BG = "#264f78";

export interface LinkFocusState {
  focusedIndex: number | null;
}

export function createLinkFocusState(): LinkFocusState {
  return { focusedIndex: null };
}

export function focusNextLink(state: LinkFocusState, linkCount: number): LinkFocusState {
  if (linkCount === 0) return state;

  const next =
    state.focusedIndex === null ? 0 : (state.focusedIndex + 1) % linkCount;

  return { focusedIndex: next };
}

export function focusPreviousLink(state: LinkFocusState, linkCount: number): LinkFocusState {
  if (linkCount === 0) return state;

  const next =
    state.focusedIndex === null
      ? linkCount - 1
      : (state.focusedIndex - 1 + linkCount) % linkCount;

  return { focusedIndex: next };
}

export function commandMatchesLink(command: DisplayCommand, linkIndex: number): boolean {
  return command.linkIndex === linkIndex;
}

export function applyLinkFocus(
  displayList: DisplayCommand[],
  focusedIndex: number | null,
): DisplayCommand[] {
  if (focusedIndex === null) return displayList;

  return displayList.map((command) => {
    if (!commandMatchesLink(command, focusedIndex)) return command;

    return {
      ...command,
      fg: FOCUSED_LINK_FG,
      bg: FOCUSED_LINK_BG,
      underline: true,
    };
  });
}

export function scrollToFocusedLink(viewport: ScrollViewport, link: Link): ScrollViewport {
  const top = Math.min(...link.bounds.map((bound) => bound.y));
  const bottom = Math.max(...link.bounds.map((bound) => bound.y + bound.height));

  if (top < viewport.scrollY) {
    return scrollTo(viewport, top);
  }

  if (bottom > viewport.scrollY + viewport.viewportHeight) {
    return scrollTo(viewport, bottom - viewport.viewportHeight);
  }

  return viewport;
}

export type LinkKeyResult =
  | { kind: "focus"; state: LinkFocusState }
  | { kind: "activate"; index: number };

/** Handle link navigation keys and Enter/o to follow the focused link. */
export function handleLinkKey(
  state: LinkFocusState,
  linkCount: number,
  key: KeyEvent,
): LinkKeyResult | null {
  if (key.eventType === "release") return null;

  if (key.name === "]") {
    return { kind: "focus", state: focusNextLink(state, linkCount) };
  }

  if (key.name === "[") {
    return { kind: "focus", state: focusPreviousLink(state, linkCount) };
  }

  if ((key.name === "return" || key.name === "o") && state.focusedIndex !== null) {
    return { kind: "activate", index: state.focusedIndex };
  }

  return null;
}
