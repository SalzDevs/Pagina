import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import type { DisplayCommand, DisplayList, FillCommand, TextCommand } from "../paint/display-list";
import { textLinkFocusStyle } from "../links/focus";
import { commandBottom, isFillCommand, isTextCommand } from "../paint/display-list";

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
  setScrollY: (scrollY: number) => void;
  setFocusedLink: (focusedIndex: number | null) => void;
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

function updateLinkFocus(
  displayList: DisplayList,
  linkMounts: Map<number, LinkMount[]>,
  linkIndex: number,
  focused: boolean,
): void {
  for (const mount of linkMounts.get(linkIndex) ?? []) {
    const command = displayList[mount.commandIndex];
    if (!command || !isTextCommand(command)) continue;

    applyTextLinkStyle(mount.renderable, command, focused);
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
    focusable: false,
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
  styledList: DisplayCommand[],
  mountedCommands: MountedCommand[],
): void {
  let mountIndex = 0;

  for (const [commandIndex, command] of styledList.entries()) {
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

/** Mount the full display list once and scroll by moving the content layer. */
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
    height: Math.max(contentHeight, layout.height),
  });

  let currentDisplayList = displayList;
  let currentFocusedLinkIndex = focusedLinkIndex;
  const mountedCommands: MountedCommand[] = [];
  const linkMounts = new Map<number, LinkMount[]>();

  const applyLayout = (nextLayout: MountLayout, nextContentHeight: number) => {
    viewport.width = nextLayout.width;
    viewport.height = nextLayout.height;
    viewport.top = nextLayout.top;
    content.width = nextLayout.width;
    content.height = Math.max(nextContentHeight, nextLayout.height);
  };

  const applyFocus = (focusedIndex: number | null) => {
    if (currentFocusedLinkIndex === focusedIndex) return;

    if (currentFocusedLinkIndex !== null) {
      updateLinkFocus(currentDisplayList, linkMounts, currentFocusedLinkIndex, false);
    }

    if (focusedIndex !== null) {
      updateLinkFocus(currentDisplayList, linkMounts, focusedIndex, true);
    }

    currentFocusedLinkIndex = focusedIndex;
    renderer.requestRender();
  };

  const syncDisplayList = (nextFocusedLinkIndex: number | null = currentFocusedLinkIndex) => {
    syncMountedCommands(renderer, content, currentDisplayList, mountedCommands);
    rebuildLinkMounts(currentDisplayList, mountedCommands, linkMounts);
    currentFocusedLinkIndex = null;
    applyFocus(nextFocusedLinkIndex);
  };

  applyLayout(layout, contentHeight);
  syncDisplayList(focusedLinkIndex);

  viewport.add(content);
  renderer.root.add(viewport);

  return {
    setScrollY(scrollY: number) {
      content.top = -scrollY;
      renderer.requestRender();
    },
    setFocusedLink: applyFocus,
    relayout(nextDisplayList, nextContentHeight, nextLayout, nextFocusedLinkIndex) {
      currentDisplayList = nextDisplayList;
      applyLayout(nextLayout, nextContentHeight);
      syncDisplayList(nextFocusedLinkIndex ?? currentFocusedLinkIndex);
    },
    destroy() {
      viewport.destroyRecursively();
    },
    viewport,
  };
}

/** @deprecated Prefer mountDisplayList for interactive scrolling. */
export function clearRenderer(renderer: CliRenderer): void {
  for (const child of renderer.root.getChildren()) {
    renderer.root.remove(child);
  }
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
  mounted.setScrollY(options.scrollY ?? 0);
}
