import type { CliRenderer, KeyEvent } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

import { BREADCRUMB_HEIGHT } from "./breadcrumb";
import { formatHelpLines } from "../viewport/keybindings";
import {
  clampScrollY,
  createScrollViewport,
  handleScrollKey,
  withScroll,
} from "../viewport/scroll";

export interface HelpOverlay {
  setVisible: (visible: boolean) => void;
  setCssWarnings: (warnings: string[]) => void;
  isScrollable: () => boolean;
  handleKey: (key: KeyEvent) => boolean;
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

/** Mount a scrollable full-screen help overlay below the breadcrumb bar. */
export function mountHelpOverlay(renderer: CliRenderer): HelpOverlay {
  let cssWarnings: string[] = [];
  let scrollY = 0;
  let lineCount = 0;
  let panelHeight = Math.max(1, renderer.height - BREADCRUMB_HEIGHT);

  const panel = new BoxRenderable(renderer, {
    id: "pagina-help",
    width: renderer.width,
    height: panelHeight,
    position: "absolute",
    top: BREADCRUMB_HEIGHT,
    left: 0,
    backgroundColor: "#0c0c0c",
    shouldFill: true,
    overflow: "hidden",
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
  });

  panel.add(text);
  renderer.root.add(panel);

  const scrollViewport = () =>
    withScroll(createScrollViewport(1, panelHeight, 1, lineCount), { scrollY });

  const clampScroll = () => {
    scrollY = clampScrollY(scrollViewport(), scrollY);
  };

  const applyScroll = () => {
    text.top = -scrollY;
    renderer.requestRender();
  };

  const refresh = (width: number) => {
    const lines = formatHelpLines(width, { cssWarnings });
    lineCount = lines.length;
    text.content = lines.join("\n");
    text.width = Math.max(0, width - 2);
    clampScroll();
    applyScroll();
  };

  const handleMouseScroll = (delta: number) => {
    scrollY = clampScrollY(scrollViewport(), scrollY + delta);
    applyScroll();
  };

  panel.onMouseScroll = (event) => {
    if (!panel.visible || !event.scroll) return;
    const delta = event.scroll.direction === "down" ? event.scroll.delta : -event.scroll.delta;
    handleMouseScroll(delta);
  };

  refresh(renderer.width);

  return {
    setVisible(visible: boolean) {
      if (visible) {
        scrollY = 0;
        applyScroll();
      }
      panel.visible = visible;
      renderer.requestRender();
    },
    setCssWarnings(warnings: string[]) {
      cssWarnings = warnings;
      refresh(renderer.width);
    },
    isScrollable() {
      return lineCount > panelHeight;
    },
    handleKey(key: KeyEvent) {
      const next = handleScrollKey(scrollViewport(), key);
      if (!next) return false;
      scrollY = next.scrollY;
      applyScroll();
      return true;
    },
    resize(width: number, height: number) {
      panel.width = width;
      panelHeight = Math.max(1, height - BREADCRUMB_HEIGHT);
      panel.height = panelHeight;
      refresh(width);
    },
    destroy() {
      panel.onMouseScroll = undefined;
      panel.destroyRecursively();
    },
  };
}
