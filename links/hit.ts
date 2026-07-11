import type { Link } from "./types";

/** Return the index of the link at a document-space point, if any. */
export function linkIndexAtPoint(links: Link[], x: number, y: number): number | null {
  for (let index = 0; index < links.length; index++) {
    const link = links[index];
    if (!link) continue;

    for (const bound of link.bounds) {
      if (
        x >= bound.x &&
        x < bound.x + bound.width &&
        y >= bound.y &&
        y < bound.y + bound.height
      ) {
        return index;
      }
    }
  }

  return null;
}
