import type { Link, LinkBounds } from "./types";

export interface LinkHitEntry {
  linkIndex: number;
  bound: LinkBounds;
}

export interface LinkHitIndex {
  rows: Map<number, LinkHitEntry[]>;
}

function pointInBound(x: number, y: number, bound: LinkBounds): boolean {
  return (
    x >= bound.x &&
    x < bound.x + bound.width &&
    y >= bound.y &&
    y < bound.y + bound.height
  );
}

/** Bucket link bounds by document row for faster hit-testing. */
export function buildLinkHitIndex(links: Link[]): LinkHitIndex {
  const rows = new Map<number, LinkHitEntry[]>();

  for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
    const link = links[linkIndex];
    if (!link) continue;

    for (const bound of link.bounds) {
      const startY = bound.y;
      const endY = bound.y + Math.max(1, bound.height) - 1;

      for (let row = startY; row <= endY; row++) {
        const bucket = rows.get(row) ?? [];
        bucket.push({ linkIndex, bound });
        rows.set(row, bucket);
      }
    }
  }

  return { rows };
}

/** Return the index of the link at a document-space point, if any. */
export function linkIndexAtPoint(index: LinkHitIndex, x: number, y: number): number | null {
  const row = Math.trunc(y);

  for (const entry of index.rows.get(row) ?? []) {
    if (pointInBound(x, y, entry.bound)) {
      return entry.linkIndex;
    }
  }

  return null;
}
