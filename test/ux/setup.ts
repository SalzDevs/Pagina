import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createTestRenderer } from "@opentui/core/testing";

import { createPaginaApp } from "../../app/pagina-app";

export interface UxTestContext {
  app: Awaited<ReturnType<typeof createPaginaApp>>;
  configDir: string;
  renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"];
  mockInput: Awaited<ReturnType<typeof createTestRenderer>>["mockInput"];
  mockMouse: Awaited<ReturnType<typeof createTestRenderer>>["mockMouse"];
  flush: Awaited<ReturnType<typeof createTestRenderer>>["flush"];
  waitForFrame: Awaited<ReturnType<typeof createTestRenderer>>["waitForFrame"];
  renderOnce: Awaited<ReturnType<typeof createTestRenderer>>["renderOnce"];
  captureCharFrame: Awaited<ReturnType<typeof createTestRenderer>>["captureCharFrame"];
  cleanup: () => Promise<void>;
}

/** Boot Pagina against a local example page for UX flow tests. */
export async function createUxTestApp(
  page = "examples/links-page.html",
  options: {
    width?: number;
    height?: number;
    configDir?: string;
    keepConfig?: boolean;
    seedBookmarks?: Array<{ name: string; location: string }>;
  } = {},
): Promise<UxTestContext> {
  const ownsConfigDir = !options.configDir;
  const configDir =
    options.configDir ?? (await mkdtemp(join(tmpdir(), "pagina-ux-")));
  const keepConfig = options.keepConfig ?? false;

  if (options.seedBookmarks) {
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "bookmarks.json"),
      `${JSON.stringify({ bookmarks: options.seedBookmarks }, null, 2)}\n`,
    );
  }

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
    configDir,
    renderer: harness.renderer,
    mockInput: harness.mockInput,
    mockMouse: harness.mockMouse,
    flush: harness.flush,
    waitForFrame: harness.waitForFrame,
    renderOnce: harness.renderOnce,
    captureCharFrame: harness.captureCharFrame,
    async cleanup() {
      app.destroy();
      harness.renderer.destroy();
      if (ownsConfigDir && !keepConfig) {
        await rm(configDir, { recursive: true, force: true });
      }
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

/** Click at root-relative terminal coordinates. */
export async function click(ctx: UxTestContext, x: number, y: number) {
  await ctx.mockMouse.click(x, y);
  await ctx.flush();
}

/** Move the mouse without clicking. */
export async function moveMouse(ctx: UxTestContext, x: number, y: number) {
  await ctx.mockMouse.moveTo(x, y);
  await ctx.flush();
}

/** Press Tab in the active prompt. */
export async function pressTab(ctx: UxTestContext) {
  ctx.mockInput.pressTab();
  await ctx.flush();
}

/** Press an arrow key in the active prompt. */
export async function pressArrow(
  ctx: UxTestContext,
  direction: "up" | "down" | "left" | "right",
) {
  ctx.mockInput.pressArrow(direction);
  await ctx.flush();
}

export function breadcrumb(ctx: UxTestContext): string {
  return ctx.app.getBreadcrumbText();
}
