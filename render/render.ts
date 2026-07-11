import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";

export interface RenderOptions {
  scrollY?: number;
  viewportHeight?: number;
}

export interface MountedDisplayList {
  setScrollY: (scrollY: number) => void;
  destroy: () => void;
  viewport: BoxRenderable;
}

/** Mount the full display list once and scroll by moving the content layer. */
export function mountDisplayList(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
): MountedDisplayList {
  const viewport = new BoxRenderable(renderer, {
    id: "pagina-viewport",
    width: renderer.width,
    height: renderer.height,
    overflow: "hidden",
  });

  const content = new BoxRenderable(renderer, {
    id: "pagina-content",
    position: "absolute",
    top: 0,
    left: 0,
    width: renderer.width,
    height: Math.max(contentHeight, renderer.height),
  });

  for (const [index, command] of displayList.entries()) {
    if (command.text.length === 0) continue;

    content.add(
      new TextRenderable(renderer, {
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
      }),
    );
  }

  viewport.add(content);
  renderer.root.add(viewport);

  return {
    setScrollY(scrollY: number) {
      content.top = -scrollY;
      renderer.requestRender();
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
    displayList.length === 0 ? 0 : Math.max(...displayList.map((command) => command.y)) + 1;
  const mounted = mountDisplayList(renderer, displayList, contentHeight);
  mounted.setScrollY(options.scrollY ?? 0);
}
