import type { CliRenderer } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";
import { mountDisplayList, type MountedDisplayList } from "../render/render";
import {
  createScrollViewport,
  handleScrollKey,
  scrollBy,
  scrollTo,
  type ScrollViewport,
} from "../viewport/scroll";

export interface ScrollSession {
  viewport: ScrollViewport;
  attach: () => void;
}

export function createScrollSession(
  renderer: CliRenderer,
  displayList: DisplayList,
  contentHeight: number,
): ScrollSession {
  let viewport = createScrollViewport(renderer.height, contentHeight);
  const mounted: MountedDisplayList = mountDisplayList(renderer, displayList, contentHeight);

  const syncViewport = (next: ScrollViewport) => {
    viewport = scrollTo(
      {
        ...next,
        viewportHeight: renderer.height,
        contentHeight,
      },
      next.scrollY,
    );
    mounted.setScrollY(viewport.scrollY);
  };

  syncViewport(viewport);

  return {
    get viewport() {
      return viewport;
    },
    attach: () => {
      renderer._internalKeyInput.onInternal("keypress", (key) => {
        const next = handleScrollKey(viewport, key);
        if (!next) return;
        syncViewport(next);
      });

      mounted.viewport.onMouseScroll = (event) => {
        if (!event.scroll) return;

        const delta = event.scroll.direction === "down" ? event.scroll.delta : -event.scroll.delta;
        syncViewport(scrollBy(viewport, delta));
      };
    },
  };
}
