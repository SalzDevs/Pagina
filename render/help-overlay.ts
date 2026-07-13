import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import { BREADCRUMB_HEIGHT } from "./breadcrumb";
import { formatHelpLines } from "../viewport/keybindings";

export interface HelpOverlay {
  setVisible: (visible: boolean) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/** Mount a full-screen help overlay below the breadcrumb bar. */
export function mountHelpOverlay(renderer: CliRenderer): HelpOverlay {
  const panel = new BoxRenderable(renderer, {
    id: "pagina-help",
    width: renderer.width,
    height: Math.max(1, renderer.height - BREADCRUMB_HEIGHT),
    position: "absolute",
    top: BREADCRUMB_HEIGHT,
    left: 0,
    backgroundColor: "#0c0c0c",
    shouldFill: true,
    visible: false,
  });

  const text = new TextRenderable(renderer, {
    id: "pagina-help-text",
    content: "",
    position: "absolute",
    left: 1,
    top: 0,
    width: Math.max(0, renderer.width - 2),
    fg: "#cccccc",
    bg: "#0c0c0c",
    attributes: createTextAttributes({ bold: false }),
    selectable: false,
    focusable: false,
  });

  panel.add(text);
  renderer.root.add(panel);

  const refresh = (width: number) => {
    text.content = formatHelpLines(width).join("\n");
    text.width = Math.max(0, width - 2);
    renderer.requestRender();
  };

  refresh(renderer.width);

  return {
    setVisible(visible: boolean) {
      panel.visible = visible;
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
