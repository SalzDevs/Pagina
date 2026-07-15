import type { KeyEvent } from "@opentui/core";

import type { DisplayCommand, DisplayList, TextCommand } from "../paint/display-list";
import { isTextCommand } from "../paint/display-list";
import type { ScrollViewport } from "../viewport/scroll";
import { scrollToRevealY } from "../viewport/scroll";
import type { Link } from "./types";
import { focusedLinkColors } from "./focus-style";

export interface LinkFocusState {
  focusedIndex: number | null;
}

export function createLinkFocusState(): LinkFocusState {
  return { focusedIndex: null };
}

/** Resolve which link should appear focused after a mouse move. */
export function resolveMouseLinkFocus(
  hoveredLinkIndex: number | null,
  keyboardFocusedLinkIndex: number | null,
): number | null {
  return hoveredLinkIndex ?? keyboardFocusedLinkIndex;
}

export function focusableLinkCount(links: Link[]): number {
  return documentLinkFocusIndices(links).length;
}

/** Choose the link to focus when a page is first shown. */
export function initialLinkFocusIndex(
  links: Link[],
  options: {
    restoredIndex?: number | null;
    hasSavedScroll?: boolean;
    visitingFragment?: boolean;
  } = {},
): number | null {
  if (
    options.restoredIndex !== null &&
    options.restoredIndex !== undefined &&
    options.restoredIndex >= 0
  ) {
    return options.restoredIndex;
  }

  if (options.hasSavedScroll || options.visitingFragment) return null;

  return documentLinkFocusIndices(links)[0] ?? null;
}

/** Format a breadcrumb hint when links exist but none are focused. */
export function formatLinkHintStatus(linkCount: number, width: number): string {
  if (linkCount <= 0) return "";

  const variants = [
    ` | ${linkCount} links — press ]`,
    ` | ${linkCount} links`,
    ` | ]`,
  ];

  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return variants[variants.length - 1]!;
}

/** Indices of every focusable link in document order. */
export function documentLinkFocusIndices(links: Link[]): number[] {
  const indices: number[] = [];

  for (let index = 0; index < links.length; index++) {
    if (links[index]?.href) indices.push(index);
  }

  return indices;
}

/** Indices of the first link for each unique href, in document order. */
export function uniqueLinkFocusIndices(links: Link[]): number[] {
  const seen = new Set<string>();
  const indices: number[] = [];

  for (let index = 0; index < links.length; index++) {
    const href = links[index]?.href;
    if (!href || seen.has(href)) continue;

    seen.add(href);
    indices.push(index);
  }

  return indices;
}

function currentFocusPosition(order: number[], focusedIndex: number | null): number {
  if (focusedIndex === null) return -1;
  return order.indexOf(focusedIndex);
}

export function focusNextLink(state: LinkFocusState, links: Link[]): LinkFocusState {
  const order = documentLinkFocusIndices(links);
  if (order.length === 0) return state;

  const current = currentFocusPosition(order, state.focusedIndex);
  const next = current === -1 ? 0 : (current + 1) % order.length;

  return { focusedIndex: order[next]! };
}

export function focusPreviousLink(state: LinkFocusState, links: Link[]): LinkFocusState {
  const order = documentLinkFocusIndices(links);
  if (order.length === 0) return state;

  const current = currentFocusPosition(order, state.focusedIndex);
  const next =
    current === -1
      ? order.length - 1
      : (current - 1 + order.length) % order.length;

  return { focusedIndex: order[next]! };
}

export function commandMatchesLink(command: DisplayCommand, linkIndex: number): boolean {
  return isTextCommand(command) && command.linkIndex === linkIndex;
}

/** Map each link index to its text command indices in a display list. */
export function linkCommandIndices(displayList: DisplayList): Map<number, number[]> {
  const indices = new Map<number, number[]>();

  for (const [commandIndex, command] of displayList.entries()) {
    if (!isTextCommand(command) || command.linkIndex === undefined) continue;

    const bucket = indices.get(command.linkIndex) ?? [];
    bucket.push(commandIndex);
    indices.set(command.linkIndex, bucket);
  }

  return indices;
}

export interface FocusedTextStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Return text styles for a link command, focused or at rest. */
export function textLinkFocusStyle(command: TextCommand, focused: boolean): FocusedTextStyle {
  if (focused) {
    const colors = focusedLinkColors(command.fg, command.bg);
    return {
      fg: colors.fg,
      bg: colors.bg,
      bold: command.bold,
      italic: command.italic,
      underline: true,
    };
  }

  return {
    fg: command.fg,
    bg: command.bg,
    bold: command.bold,
    italic: command.italic,
    underline: command.underline,
  };
}

export function applyLinkFocus(
  displayList: DisplayList,
  focusedIndex: number | null,
): DisplayList {
  if (focusedIndex === null) return displayList;

  return displayList.map((command) => {
    if (!commandMatchesLink(command, focusedIndex) || !isTextCommand(command)) return command;

    const colors = focusedLinkColors(command.fg, command.bg);
    return {
      ...command,
      fg: colors.fg,
      bg: colors.bg,
      underline: true,
    };
  });
}

export function scrollToFocusedLink(viewport: ScrollViewport, link: Link): ScrollViewport {
  const top = Math.min(...link.bounds.map((bound) => bound.y));
  const bottom = Math.max(...link.bounds.map((bound) => bound.y + bound.height));
  const height = Math.max(1, bottom - top);

  return scrollToRevealY(viewport, top, height);
}

export type LinkKeyResult =
  | { kind: "focus"; state: LinkFocusState }
  | { kind: "activate"; index: number };

/** Handle link navigation keys and Enter/o to follow the focused link. */
export function handleLinkKey(
  state: LinkFocusState,
  links: Link[],
  key: KeyEvent,
): LinkKeyResult | null {
  if (key.eventType === "release") return null;

  if (key.name === "]") {
    return { kind: "focus", state: focusNextLink(state, links) };
  }

  if (key.name === "[") {
    return { kind: "focus", state: focusPreviousLink(state, links) };
  }

  if ((key.name === "return" || key.name === "o") && state.focusedIndex !== null) {
    return { kind: "activate", index: state.focusedIndex };
  }

  return null;
}
