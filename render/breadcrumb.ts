import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextRenderable, createTextAttributes } from "@opentui/core";

export const BREADCRUMB_HEIGHT = 1;

export interface BreadcrumbBar {
  height: number;
  bar: BoxRenderable;
  update: (text: string) => void;
  getText: () => string;
  resize: (width: number) => void;
  destroy: () => void;
}

function stringifyRenderableText(content: unknown): string {
  if (typeof content === "string") return content;
  if (
    content &&
    typeof content === "object" &&
    "chunks" in content &&
    Array.isArray((content as { chunks: unknown[] }).chunks)
  ) {
    return (content as { chunks: Array<{ text?: string }> }).chunks
      .map((chunk) => chunk.text ?? "")
      .join("");
  }

  return String(content ?? "");
}

/** Mount a persistent breadcrumb bar at the top of the terminal. */
export function mountBreadcrumb(renderer: CliRenderer): BreadcrumbBar {
  const bar = new BoxRenderable(renderer, {
    id: "pagina-breadcrumb",
    width: renderer.width,
    height: BREADCRUMB_HEIGHT,
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#1e1e1e",
    shouldFill: true,
  });

  const text = new TextRenderable(renderer, {
    id: "pagina-breadcrumb-text",
    content: "",
    position: "absolute",
    left: 1,
    top: 0,
    width: Math.max(0, renderer.width - 1),
    fg: "#cccccc",
    bg: "#1e1e1e",
    attributes: createTextAttributes({ bold: false }),
    selectable: false,
  });

  bar.add(text);
  renderer.root.add(bar);

  return {
    height: BREADCRUMB_HEIGHT,
    bar,
    update(content: string) {
      text.content = content;
      renderer.requestRender();
    },
    getText() {
      return stringifyRenderableText(text.content);
    },
    resize(width: number) {
      bar.width = width;
      text.width = Math.max(0, width - 1);
      renderer.requestRender();
    },
    destroy() {
      bar.destroyRecursively();
    },
  };
}
