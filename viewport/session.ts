import type { CliRenderer } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";
import { clearRenderer, render } from "../render/render";
import {
  createScrollViewport,
  handleScrollKey,
  type ScrollViewport,
} from "../viewport/scroll";

export interface ScrollSession {
  viewport: ScrollViewport;
  rerender: () => void;
  attach: () => void;
}

export function createScrollSession(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
): ScrollSession {
  let viewport = createScrollViewport(renderer.height, contentHeight);

  const rerender = () => {
    clearRenderer(renderer);
    render(renderer, displayList, {
      scrollY: viewport.scrollY,
      viewportHeight: viewport.viewportHeight,
    });
    renderer.requestRender();
  };

  const attach = () => {
    renderer.keyInput.on("keypress", (key) => {
      const next = handleScrollKey(viewport, key);
      if (!next || next.scrollY === viewport.scrollY) return;

      viewport = next;
      rerender();
    });
  };

  return {
    get viewport() {
      return viewport;
    },
    rerender,
    attach,
  };
}
