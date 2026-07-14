import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import { historyLabel } from "../navigation/history";
import { BREADCRUMB_HEIGHT } from "./breadcrumb";

export interface LoadingOverlay {
  /** Show loading UI. Use dimContent when there is no page to keep visible yet. */
  show: (location: string, options?: { dimContent?: boolean }) => void;
  hide: () => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/** Format the loading placeholder shown below the breadcrumb. */
export function formatLoadingOverlayContent(location: string, width: number): string {
  const label = historyLabel(location);
  const detail =
    label.length <= width ? label : label.slice(0, Math.max(0, width - 3)) + "...";

  return ["Loading…", "", detail].join("\n");
}

/** Mount a loading indicator in the content area below the breadcrumb. */
export function mountLoadingOverlay(renderer: CliRenderer): LoadingOverlay {
  const panel = new BoxRenderable(renderer, {
    id: "pagina-loading",
    width: renderer.width,
    height: Math.max(1, renderer.height - BREADCRUMB_HEIGHT),
    position: "absolute",
    top: BREADCRUMB_HEIGHT,
    left: 0,
    backgroundColor: "#0a0a0a",
    shouldFill: true,
    visible: false,
  });

  const text = new TextRenderable(renderer, {
    id: "pagina-loading-text",
    content: "",
    position: "absolute",
    left: 1,
    top: 0,
    width: Math.max(0, renderer.width - 2),
    fg: "#888888",
    bg: "#0a0a0a",
    attributes: createTextAttributes({ bold: false, italic: true }),
    selectable: false,
  });

  panel.add(text);
  renderer.root.add(panel);

  let location = "";
  let dimContent = true;

  const applyMode = () => {
    panel.shouldFill = dimContent;
    panel.backgroundColor = dimContent ? "#0a0a0a" : undefined;
    text.bg = dimContent ? "#0a0a0a" : undefined;
    text.top = dimContent ? 0 : Math.max(0, panel.height - 1);
  };

  const refresh = (width: number) => {
    text.content = formatLoadingOverlayContent(location, Math.max(0, width - 2));
    text.width = Math.max(0, width - 2);
    applyMode();
    renderer.requestRender();
  };

  const raiseToFront = () => {
    if (panel.parent === renderer.root) {
      renderer.root.remove(panel);
    }
    renderer.root.add(panel);
  };

  return {
    show(nextLocation: string, options: { dimContent?: boolean } = {}) {
      location = nextLocation;
      dimContent = options.dimContent ?? true;
      panel.visible = true;
      refresh(renderer.width);
      raiseToFront();
    },
    hide() {
      panel.visible = false;
      renderer.requestRender();
    },
    resize(width: number, height: number) {
      panel.width = width;
      panel.height = Math.max(1, height - BREADCRUMB_HEIGHT);
      refresh(width);
    },
    destroy() {
      panel.destroyRecursively();
    },
  };
}
