import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import { historyLabel } from "../navigation/history";
import { BREADCRUMB_HEIGHT } from "./breadcrumb";

export interface LoadingOverlay {
  setVisible: (visible: boolean) => void;
  update: (location: string) => void;
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

/** Mount a dim loading placeholder in the content area below the breadcrumb. */
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

  const refresh = (width: number) => {
    text.content = formatLoadingOverlayContent(location, Math.max(0, width - 2));
    text.width = Math.max(0, width - 2);
    renderer.requestRender();
  };

  return {
    setVisible(visible: boolean) {
      panel.visible = visible;
      renderer.requestRender();
    },
    update(nextLocation: string) {
      location = nextLocation;
      refresh(renderer.width);
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
