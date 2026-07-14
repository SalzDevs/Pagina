import type { MountLayout } from "../render/render";

export interface MouseEventPoint {
  x: number;
  y: number;
}

export interface DocumentPoint {
  x: number;
  y: number;
}

/** Convert root-relative OpenTUI mouse coords into document-space for link hit testing. */
export function mouseToDocumentPoint(
  event: MouseEventPoint,
  layout: Pick<MountLayout, "top">,
  scrollY: number,
  scrollX = 0,
): DocumentPoint {
  return {
    x: event.x + scrollX,
    y: event.y - layout.top + scrollY,
  };
}
