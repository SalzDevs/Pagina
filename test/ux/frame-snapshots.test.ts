/**
 * Golden terminal frame snapshots for representative example pages.
 *
 * Update snapshots after intentional UI changes:
 *   bun run test:ux:update-snapshots
 *
 * Or for a single file:
 *   bun test test/ux/frame-snapshots.test.ts --update-snapshots
 */
import { afterEach, describe, expect, test } from "bun:test";

import { createUxTestApp, type UxTestContext } from "./setup";
import { normalizeFrame } from "./frame-normalize";

const VIEWPORT = { width: 80, height: 24 } as const;

const SNAPSHOT_PAGES = [
  { page: "examples/page.html", name: "page" },
  { page: "examples/styled-page.html", name: "styled-page" },
  { page: "examples/links-page.html", name: "links-page" },
  { page: "examples/lists-page.html", name: "lists-page" },
  { page: "examples/table-page.html", name: "table-page" },
] as const;

const contexts: UxTestContext[] = [];

afterEach(async () => {
  while (contexts.length > 0) {
    await contexts.pop()?.cleanup();
  }
});

async function boot(page: string): Promise<UxTestContext> {
  const ctx = await createUxTestApp(page, VIEWPORT);
  contexts.push(ctx);
  return ctx;
}

describe("UX frame snapshots", () => {
  for (const { page, name } of SNAPSHOT_PAGES) {
    test(`${name} at ${VIEWPORT.width}x${VIEWPORT.height}`, async () => {
      const ctx = await boot(page);
      const frame = normalizeFrame(ctx.captureCharFrame());

      expect(frame.split("\n").length).toBe(VIEWPORT.height + 1);
      expect(frame).toMatchSnapshot(name);
    });
  }
});
