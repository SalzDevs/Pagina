/**
 * Golden display-list snapshots for all example pages.
 *
 * Update snapshots after intentional layout or paint changes:
 *   bun run test:render-compare:update-snapshots
 *
 * Or for this file only:
 *   bun test test/render-compare/display-list-snapshots.test.ts --update-snapshots
 */
import { describe, expect, test } from "bun:test";

import { buildDisplayListSnapshot } from "./serialize-display-list";
import { DEFAULT_VIEWPORT, EXAMPLE_PAGES, MEDIUM_VIEWPORT } from "./fixtures";

const SNAPSHOT_VIEWPORTS = [
  { viewport: DEFAULT_VIEWPORT, label: "80x24" },
  { viewport: MEDIUM_VIEWPORT, label: "40x24" },
] as const;

function pageSlug(pagePath: string): string {
  return pagePath.replace(/^examples\//, "").replace(/\//g, "-").replace(/\.html$/, "");
}

describe("display-list snapshots", () => {
  for (const pagePath of EXAMPLE_PAGES) {
    const slug = pageSlug(pagePath);

    for (const { viewport, label } of SNAPSHOT_VIEWPORTS) {
      test(`${slug} at ${label}`, async () => {
        const snapshot = await buildDisplayListSnapshot(pagePath, viewport);
        expect(snapshot.length).toBeGreaterThan(0);
        expect(snapshot).toMatchSnapshot(`${slug}-${label}`);
      });
    }
  }
});
