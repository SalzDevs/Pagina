import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import type { DisplayCommand, DisplayList, FillCommand, TextCommand } from "../paint/display-list";
import { textLinkFocusStyle } from "../links/focus";
import { commandBottom, isFillCommand, isTextCommand } from "../paint/display-list";
import {
  displayListMountEntries,
  measureDisplayListWidth,
  shouldCullDisplayList,
  type VisibleCommandEntry,
} from "../viewport/visible";

export const SEARCH_MATCH_FG = "#ffffff";
export const SEARCH_MATCH_BG = "#665500";
export const SEARCH_ACTIVE_FG = "#000000";
export const SEARCH_ACTIVE_BG = "#ffcc00";

export interface RenderOptions {
  scrollY?: number;
  viewportHeight?: number;
}

export interface MountLayout {
  top: number;
  height: number;
  width: number;
}

export interface MountedDisplayList {
  setScroll: (scrollY: number, scrollX: number) => void;
  setFocusedLink: (focusedIndex: number | null) => void;
  setSearchHighlight: (
    matchCommandIndices: ReadonlySet<number>,
    activeCommandIndex: number | null,
  ) => void;
  clearSearchHighlight: () => void;
  relayout: (
    displayList: DisplayList,
    contentHeight: number,
    layout: MountLayout,
    focusedLinkIndex?: number | null,
  ) => void;
  destroy: () => void;
  viewport: BoxRenderable;
}

type MountedCommand =
  | { kind: "fill"; commandIndex: number; renderable: BoxRenderable }
  | { kind: "text"; commandIndex: number; renderable: TextRenderable };

interface LinkMount {
  commandIndex: number;
  renderable: TextRenderable;
}

interface SearchMount {
  commandIndex: number;
  renderable: TextRenderable;
}

function applyTextLinkStyle(
  renderable: TextRenderable,
  command: TextCommand,
  focused: boolean,
): void {
  const style = textLinkFocusStyle(command, focused);
  renderable.fg = style.fg;
  renderable.bg = style.bg;
  renderable.attributes = createTextAttributes({
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
  });
}

function applyTextSearchStyle(
  renderable: TextRenderable,
  command: TextCommand,
  active: boolean,
): void {
  renderable.fg = active ? SEARCH_ACTIVE_FG : SEARCH_MATCH_FG;
  renderable.bg = active ? SEARCH_ACTIVE_BG : SEARCH_MATCH_BG;
  renderable.attributes = createTextAttributes({
    bold: command.bold,
    italic: command.italic,
    underline: command.underline,
  });
}

function rebuildSearchMounts(
  mountedCommands: MountedCommand[],
  searchMounts: Map<number, SearchMount>,
): void {
  searchMounts.clear();

  for (const mounted of mountedCommands) {
    if (mounted.kind !== "text") continue;

    searchMounts.set(mounted.commandIndex, {
      commandIndex: mounted.commandIndex,
      renderable: mounted.renderable,
    });
  }
}

function rebuildLinkMounts(
  displayList: DisplayList,
  mountedCommands: MountedCommand[],
  linkMounts: Map<number, LinkMount[]>,
): void {
  linkMounts.clear();

  for (const mounted of mountedCommands) {
    if (mounted.kind !== "text") continue;

    const command = displayList[mounted.commandIndex];
    if (!command || !isTextCommand(command) || command.linkIndex === undefined) continue;

    const bucket = linkMounts.get(command.linkIndex) ?? [];
    bucket.push({
      commandIndex: mounted.commandIndex,
      renderable: mounted.renderable,
    });
    linkMounts.set(command.linkIndex, bucket);
  }
}

function applyTextCommand(renderable: TextRenderable, command: TextCommand): void {
  renderable.content = command.text;
  renderable.left = command.x;
  renderable.top = command.y;
  renderable.fg = command.fg;
  renderable.bg = command.bg;
  renderable.attributes = createTextAttributes({
    bold: command.bold,
    italic: command.italic,
    underline: command.underline,
  });
}

function createTextRenderable(
  renderer: CliRenderer,
  index: number,
  command: TextCommand,
): TextRenderable {
  const renderable = new TextRenderable(renderer, {
    id: `display-cmd-${index}`,
    content: command.text,
    position: "absolute",
    left: command.x,
    top: command.y,
    fg: command.fg,
    bg: command.bg,
    attributes: createTextAttributes({
      bold: command.bold,
      italic: command.italic,
      underline: command.underline,
    }),
    selectable: false,
  });

  return renderable;
}

function applyFillCommand(renderable: BoxRenderable, command: FillCommand): void {
  renderable.left = command.x;
  renderable.top = command.y;
  renderable.width = command.width;
  renderable.height = command.height;
  renderable.backgroundColor = command.bg;
}

function createFillRenderable(
  renderer: CliRenderer,
  index: number,
  command: FillCommand,
): BoxRenderable {
  return new BoxRenderable(renderer, {
    id: `display-fill-${index}`,
    position: "absolute",
    left: command.x,
    top: command.y,
    width: command.width,
    height: command.height,
    backgroundColor: command.bg,
    shouldFill: true,
  });
}

function removeMountedCommand(content: BoxRenderable, mounted: MountedCommand): void {
  content.remove(mounted.renderable);
  mounted.renderable.destroy();
}

function syncMountedCommands(
  renderer: CliRenderer,
  content: BoxRenderable,
  entries: VisibleCommandEntry[],
  mountedCommands: MountedCommand[],
): void {
  let mountIndex = 0;

  for (const { commandIndex, command } of entries) {
    if (isFillCommand(command)) {
      const existing = mountedCommands[mountIndex];

      if (existing?.kind === "fill") {
        applyFillCommand(existing.renderable, command);
        existing.commandIndex = commandIndex;
      } else {
        if (existing) {
          removeMountedCommand(content, existing);
        }

        const renderable = createFillRenderable(renderer, commandIndex, command);
        content.add(renderable);
        mountedCommands[mountIndex] = { kind: "fill", commandIndex, renderable };
      }

      mountIndex++;
      continue;
    }

    if (!isTextCommand(command) || command.text.length === 0) continue;

    const existing = mountedCommands[mountIndex];

    if (existing?.kind === "text") {
      applyTextCommand(existing.renderable, command);
      existing.commandIndex = commandIndex;
    } else {
      if (existing) {
        removeMountedCommand(content, existing);
      }

      const renderable = createTextRenderable(renderer, commandIndex, command);
      content.add(renderable);
      mountedCommands[mountIndex] = { kind: "text", commandIndex, renderable };
    }

    mountIndex++;
  }

  while (mountedCommands.length > mountIndex) {
    const removed = mountedCommands.pop();
    if (removed) {
      removeMountedCommand(content, removed);
    }
  }
}

/** Mount the display list and scroll via translation or viewport culling. */
export function mountDisplayList(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
  focusedLinkIndex: number | null = null,
  layout: MountLayout = {
    top: 0,
    height: renderer.height,
    width: renderer.width,
  },
): MountedDisplayList {
  const useCulling = shouldCullDisplayList(displayList, contentHeight, layout.height);

  const viewport = new BoxRenderable(renderer, {
    id: "pagina-viewport",
    width: layout.width,
    height: layout.height,
    position: "absolute",
    top: layout.top,
    left: 0,
    overflow: "hidden",
  });

  const content = new BoxRenderable(renderer, {
    id: "pagina-content",
    position: "absolute",
    top: 0,
    left: 0,
    width: layout.width,
    height: useCulling ? layout.height : Math.max(contentHeight, layout.height),
  });

  let currentDisplayList = displayList;
  let currentFocusedLinkIndex = focusedLinkIndex;
  let currentScrollX = 0;
  let currentScrollY = 0;
  let currentContentWidth = measureDisplayListWidth(displayList);
  let currentContentHeight = contentHeight;
  let currentLayout = layout;
  let cullingEnabled = useCulling;
  const mountedCommands: MountedCommand[] = [];
  const linkMounts = new Map<number, LinkMount[]>();
  const searchMounts = new Map<number, SearchMount>();
  let highlightedSearchCommands = new Set<number>();
  let activeSearchCommandIndex: number | null = null;

  const applyTextStylesForCommand = (commandIndex: number) => {
    const mount = searchMounts.get(commandIndex);
    if (!mount) return;

    const command = currentDisplayList[commandIndex];
    if (!command || !isTextCommand(command)) return;

    const isFocusedLink =
      command.linkIndex !== undefined && command.linkIndex === currentFocusedLinkIndex;
    const isSearchMatch = highlightedSearchCommands.has(commandIndex);
    const isActiveSearch = commandIndex === activeSearchCommandIndex;

    if (isFocusedLink) {
      applyTextLinkStyle(mount.renderable, command, true);
      return;
    }

    if (isSearchMatch) {
      applyTextSearchStyle(mount.renderable, command, isActiveSearch);
      return;
    }

    applyTextCommand(mount.renderable, command);
  };

  const applyLayout = (nextLayout: MountLayout, nextContentHeight: number, nextContentWidth: number) => {
    currentLayout = nextLayout;
    currentContentWidth = nextContentWidth;
    viewport.width = nextLayout.width;
    viewport.height = nextLayout.height;
    viewport.top = nextLayout.top;
    content.width = Math.max(nextLayout.width, nextContentWidth);
    content.height = cullingEnabled
      ? nextLayout.height
      : Math.max(nextContentHeight, nextLayout.height);
  };

  const mountEntries = (): VisibleCommandEntry[] =>
    displayListMountEntries(currentDisplayList, {
      scrollX: currentScrollX,
      scrollY: currentScrollY,
      viewportWidth: currentLayout.width,
      viewportHeight: currentLayout.height,
      contentWidth: currentContentWidth,
      contentHeight: currentContentHeight,
    });

  const applyFocus = (focusedIndex: number | null) => {
    if (currentFocusedLinkIndex === focusedIndex) return;

    const previousFocused = currentFocusedLinkIndex;
    currentFocusedLinkIndex = focusedIndex;

    if (previousFocused !== null) {
      for (const mount of linkMounts.get(previousFocused) ?? []) {
        applyTextStylesForCommand(mount.commandIndex);
      }
    }

    if (focusedIndex !== null) {
      for (const mount of linkMounts.get(focusedIndex) ?? []) {
        applyTextStylesForCommand(mount.commandIndex);
      }
    }

    renderer.requestRender();
  };

  const syncDisplayList = (nextFocusedLinkIndex: number | null = currentFocusedLinkIndex) => {
    syncMountedCommands(renderer, content, mountEntries(), mountedCommands);
    rebuildLinkMounts(currentDisplayList, mountedCommands, linkMounts);
    rebuildSearchMounts(mountedCommands, searchMounts);
    const previousFocused = currentFocusedLinkIndex;
    currentFocusedLinkIndex = null;
    applyFocus(nextFocusedLinkIndex ?? previousFocused);

    for (const commandIndex of highlightedSearchCommands) {
      applyTextStylesForCommand(commandIndex);
    }

    renderer.requestRender();
  };

  const applyScroll = () => {
    if (cullingEnabled) {
      content.top = 0;
      content.left = 0;
      syncDisplayList();
      return;
    }

    content.top = -currentScrollY;
    content.left = -currentScrollX;
    renderer.requestRender();
  };

  applyLayout(layout, contentHeight, currentContentWidth);
  syncDisplayList(focusedLinkIndex);

  viewport.add(content);
  renderer.root.add(viewport);

  return {
    setScroll(scrollY: number, scrollX: number) {
      if (scrollY === currentScrollY && scrollX === currentScrollX) return;
      currentScrollY = scrollY;
      currentScrollX = scrollX;
      applyScroll();
    },
    setFocusedLink: applyFocus,
    setSearchHighlight(matchCommandIndices, activeCommandIndex) {
      const affected = new Set([...highlightedSearchCommands, ...matchCommandIndices]);
      highlightedSearchCommands = new Set(matchCommandIndices);
      activeSearchCommandIndex = activeCommandIndex;

      for (const commandIndex of affected) {
        applyTextStylesForCommand(commandIndex);
      }

      renderer.requestRender();
    },
    clearSearchHighlight() {
      if (highlightedSearchCommands.size === 0 && activeSearchCommandIndex === null) return;

      const affected = new Set(highlightedSearchCommands);
      highlightedSearchCommands = new Set();
      activeSearchCommandIndex = null;

      for (const commandIndex of affected) {
        applyTextStylesForCommand(commandIndex);
      }

      renderer.requestRender();
    },
    relayout(nextDisplayList, nextContentHeight, nextLayout, nextFocusedLinkIndex) {
      currentDisplayList = nextDisplayList;
      currentContentHeight = nextContentHeight;
      currentContentWidth = measureDisplayListWidth(nextDisplayList);
      cullingEnabled = shouldCullDisplayList(
        nextDisplayList,
        nextContentHeight,
        nextLayout.height,
      );
      applyLayout(nextLayout, nextContentHeight, currentContentWidth);
      syncDisplayList(nextFocusedLinkIndex ?? currentFocusedLinkIndex);
      if (!cullingEnabled) {
        content.top = -currentScrollY;
        content.left = -currentScrollX;
      }
    },
    destroy() {
      viewport.destroyRecursively();
    },
    viewport,
  };
}

/** Draw a visible slice of the display list. Used for static rendering only. */
export function render(
  renderer: CliRenderer,
  displayList: DisplayList,
  options: RenderOptions = {},
): void {
  const contentHeight =
    displayList.length === 0 ? 0 : Math.max(...displayList.map((command) => commandBottom(command)));
  const mounted = mountDisplayList(renderer, displayList, contentHeight);
  mounted.setScroll(options.scrollY ?? 0, 0);
}
