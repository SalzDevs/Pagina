import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import { applyLinkFocus } from "../links/focus";
import type { DisplayList } from "../paint/display-list";
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
  destroy: () => void;
  viewport: BoxRenderable;
}

interface CommandRenderable {
  commandIndex: number;
  renderable: TextRenderable;
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

  const styledList = applyLinkFocus(displayList, focusedLinkIndex);
  const commandRenderables: CommandRenderable[] = [];

  for (const [index, command] of styledList.entries()) {
    if (isFillCommand(command)) {
      content.add(
        new BoxRenderable(renderer, {
          id: `display-fill-${index}`,
          position: "absolute",
          left: command.x,
          top: command.y,
          width: command.width,
          height: command.height,
          backgroundColor: command.bg,
          shouldFill: true,
        }),
      );
      continue;
    }

    if (!isTextCommand(command) || command.text.length === 0) continue;

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

    commandRenderables.push({ commandIndex: index, renderable });
    content.add(renderable);
  }

  viewport.add(content);
  renderer.root.add(viewport);

  const applyFocus = (focusedIndex: number | null) => {
    const nextList = applyLinkFocus(displayList, focusedIndex);

    for (const { commandIndex, renderable } of commandRenderables) {
      const command = nextList[commandIndex];
      if (!command || !isTextCommand(command)) continue;

      renderable.fg = command.fg;
      renderable.bg = command.bg;
      renderable.attributes = createTextAttributes({
        bold: command.bold,
        italic: command.italic,
        underline: command.underline,
      });
    }

    renderer.requestRender();
  };

  return {
    setScrollY(scrollY: number) {
      content.top = -scrollY;
      renderer.requestRender();
    },
    setFocusedLink: applyFocus,
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
