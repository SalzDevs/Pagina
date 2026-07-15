import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import type { BrowserHistory } from "../navigation/history";
import { BREADCRUMB_HEIGHT } from "./breadcrumb";
import { formatHistoryPickerLines } from "../viewport/history-picker";

export interface HistoryOverlay {
  setVisible: (visible: boolean) => void;
  setHistory: (history: BrowserHistory, selectedIndex: number) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/** Mount a full-screen history picker overlay below the breadcrumb bar. */
export function mountHistoryOverlay(renderer: CliRenderer): HistoryOverlay {
  let currentHistory: BrowserHistory = { entries: [], index: -1 };
  let selectedIndex = 0;

  const panel = new BoxRenderable(renderer, {
    id: "pagina-history",
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
    id: "pagina-history-text",
    content: "",
    position: "absolute",
    left: 1,
    top: 0,
    width: Math.max(0, renderer.width - 2),
    fg: "#cccccc",
    bg: "#0c0c0c",
    attributes: createTextAttributes({ bold: false }),
    selectable: false,
  });

  panel.add(text);
  renderer.root.add(panel);

  const refresh = (width: number) => {
    text.content = formatHistoryPickerLines(currentHistory, width, selectedIndex).join("\n");
    text.width = Math.max(0, width - 2);
    renderer.requestRender();
  };

  refresh(renderer.width);

  return {
    setVisible(visible: boolean) {
      panel.visible = visible;
      renderer.requestRender();
    },
    setHistory(history: BrowserHistory, nextSelectedIndex: number) {
      currentHistory = history;
      selectedIndex = nextSelectedIndex;
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
