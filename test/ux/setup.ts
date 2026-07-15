import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createTestRenderer } from "@opentui/core/testing";

import { createPaginaApp } from "../../app/pagina-app";

export interface UxTestContext {
  app: Awaited<ReturnType<typeof createPaginaApp>>;
  renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"];
  mockInput: Awaited<ReturnType<typeof createTestRenderer>>["mockInput"];
  flush: Awaited<ReturnType<typeof createTestRenderer>>["flush"];
  waitForFrame: Awaited<ReturnType<typeof createTestRenderer>>["waitForFrame"];
  renderOnce: Awaited<ReturnType<typeof createTestRenderer>>["renderOnce"];
  captureCharFrame: Awaited<ReturnType<typeof createTestRenderer>>["captureCharFrame"];
  cleanup: () => Promise<void>;
}

/** Boot Pagina against a local example page for UX flow tests. */
export async function createUxTestApp(
  page = "examples/links-page.html",
  options: { width?: number; height?: number } = {},
): Promise<UxTestContext> {
  const configDir = await mkdtemp(join(tmpdir(), "pagina-ux-"));
  const harness = await createTestRenderer({
    width: options.width ?? 80,
    height: options.height ?? 24,
    kittyKeyboard: true,
  });

  const app = await createPaginaApp(harness.renderer, { configDir });
  await app.loadPage(page, "push");
  app.start();
  await harness.flush();
  await harness.renderOnce();

  return {
    app,
    renderer: harness.renderer,
    mockInput: harness.mockInput,
    flush: harness.flush,
    waitForFrame: harness.waitForFrame,
    renderOnce: harness.renderOnce,
    captureCharFrame: harness.captureCharFrame,
    async cleanup() {
      app.destroy();
      harness.renderer.destroy();
      await rm(configDir, { recursive: true, force: true });
    },
  };
}

/** Press a key and wait for Pagina handlers to run. */
export async function press(
  ctx: UxTestContext,
  key: string,
  modifiers: { shift?: boolean; ctrl?: boolean; meta?: boolean } = {},
) {
  ctx.mockInput.pressKey(key, modifiers);
  await ctx.flush();
}

/** Type text into the active prompt. */
export async function typeText(ctx: UxTestContext, text: string) {
  ctx.mockInput.typeText(text);
  await ctx.flush();
}

/** Submit the active prompt or follow a focused link. */
export async function submit(ctx: UxTestContext) {
  ctx.mockInput.pressEnter();
  await ctx.flush();
}

/** Follow the focused link. */
export async function followLink(ctx: UxTestContext) {
  await submit(ctx);
}

/** Wait for async page loads triggered by navigation. */
export async function waitForLoad(ctx: UxTestContext, ms = 50) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  await ctx.flush();
  await ctx.renderOnce();
}

/** Press Escape (requires kitty keyboard mode in the test renderer). */
export async function pressEscape(ctx: UxTestContext) {
  ctx.mockInput.pressEscape();
  await ctx.flush();
}

export function breadcrumb(ctx: UxTestContext): string {
  return ctx.app.getBreadcrumbText();
}
