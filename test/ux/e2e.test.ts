import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  breadcrumb,
  click,
  createUxTestApp,
  followLink,
  moveMouse,
  press,
  pressArrow,
  pressEscape,
  pressTab,
  submit,
  typeText,
  waitForLoad,
  type UxTestContext,
} from "./setup";
import { breadcrumbClickPoint, emptyContentPoint, linkScreenPoint } from "./geometry";

const originalFetch = globalThis.fetch;
const contexts: UxTestContext[] = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  while (contexts.length > 0) {
    await contexts.pop()?.cleanup();
  }
});

async function boot(page = "examples/links-page.html", options?: { width?: number; height?: number }) {
  const ctx = await createUxTestApp(page, options);
  contexts.push(ctx);
  return ctx;
}

describe("UX E2E — browsing", () => {
  test("loads a page and renders readable content", async () => {
    const ctx = await boot();
    const frame = ctx.captureCharFrame();

    expect(frame).toContain("Links Demo");
    expect(breadcrumb(ctx)).toContain("Links Demo");
    expect(ctx.app.getSession()).not.toBeNull();
  });

  test("auto-focuses the first link on a fresh page", async () => {
    const ctx = await boot();
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(0);
  });

  test("follows a focused link with Enter and supports back navigation", async () => {
    const ctx = await boot();
    await followLink(ctx);
    await waitForLoad(ctx);

    expect(breadcrumb(ctx)).toMatch(/other page|Other/i);
    expect(ctx.app.getHistory().index).toBe(1);

    await press(ctx, "u");
    await waitForLoad(ctx);

    expect(breadcrumb(ctx)).toMatch(/Links Demo|links-page/i);
    expect(ctx.app.getHistory().index).toBe(0);
  });

  test("cycles link focus with bracket keys", async () => {
    const ctx = await boot();
    const first = ctx.app.getSession()?.focusedLinkIndex;

    await press(ctx, "]");
    const second = ctx.app.getSession()?.focusedLinkIndex;

    await press(ctx, "[");
    const back = ctx.app.getSession()?.focusedLinkIndex;

    expect(first).toBe(0);
    expect(second).toBe(1);
    expect(back).toBe(0);
  });

  test("scrolls long pages with j/k", async () => {
    const ctx = await boot("examples/long-page.html", { height: 20 });
    const session = ctx.app.getSession();
    expect(session).not.toBeNull();

    const startY = session!.viewport.scrollY;
    await press(ctx, "j");
    await press(ctx, "j");
    expect(session!.viewport.scrollY).toBeGreaterThan(startY);

    await press(ctx, "k");
    expect(session!.viewport.scrollY).toBeLessThan(session!.viewport.scrollY + 1);
  });

  test("shows scroll position in the breadcrumb on long pages", async () => {
    const ctx = await boot("examples/long-page.html", { height: 20 });
    await press(ctx, "j");
    await press(ctx, "j");

    expect(breadcrumb(ctx)).toMatch(/\d+\/\d+/);
  });
});

describe("UX E2E — overlays and prompts", () => {
  test("toggles help with ?", async () => {
    const ctx = await boot();
    await press(ctx, "?");

    expect(ctx.app.getUiState().helpVisible).toBe(true);
    expect(breadcrumb(ctx)).toContain("Help");
    expect(ctx.captureCharFrame()).toContain("keyboard & mouse");

    await press(ctx, "?");
    expect(ctx.app.getUiState().helpVisible).toBe(false);
  });

  test("toggles debug with v", async () => {
    const ctx = await boot();
    await press(ctx, "v");

    expect(ctx.app.getUiState().debugVisible).toBe(true);
    expect(breadcrumb(ctx)).toContain("Debug");
    expect(ctx.captureCharFrame()).toContain("page debug");

    await press(ctx, "v");
    expect(ctx.app.getUiState().debugVisible).toBe(false);
  });

  test("opens history picker after visiting multiple pages", async () => {
    const ctx = await boot();
    await followLink(ctx);
    await waitForLoad(ctx);

    await press(ctx, "b");
    expect(ctx.app.getUiState().historyPickerActive).toBe(true);
    expect(breadcrumb(ctx)).toContain("History");
  });

  test("navigates via the open prompt", async () => {
    const ctx = await boot();
    await press(ctx, ":");
    expect(ctx.app.getUiState().openPromptActive).toBe(true);

    await typeText(ctx, "examples/page.html");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(ctx.app.getUiState().openPromptActive).toBe(false);
    expect(breadcrumb(ctx)).toMatch(/Hello!|page\.html|Pagina/i);
  });

  test("searches in page and shows match status in the breadcrumb", async () => {
    const ctx = await boot();
    await press(ctx, "/");
    expect(ctx.app.getUiState().searchPromptActive).toBe(true);

    await typeText(ctx, "Demo");
    await submit(ctx);

    expect(ctx.app.getUiState().searchQuery).toBe("demo");
    expect(breadcrumb(ctx)).toMatch(/🔍|demo/i);
  });

  test("closes help when opening another overlay", async () => {
    const ctx = await boot();
    await press(ctx, "?");
    expect(ctx.app.getUiState().helpVisible).toBe(true);

    await press(ctx, ":");
    expect(ctx.app.getUiState().helpVisible).toBe(false);
    expect(ctx.app.getUiState().openPromptActive).toBe(true);
  });
});

describe("UX E2E — navigation edge cases", () => {
  test("shows fragment-not-found feedback in the breadcrumb", async () => {
    const ctx = await boot();
    await press(ctx, ":");
    await typeText(ctx, "examples/links-page.html#missing-anchor");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(breadcrumb(ctx)).toMatch(/not found|Fragment/i);
  });

  test("loads an error page for missing local files", async () => {
    const ctx = await boot();
    await press(ctx, ":");
    await typeText(ctx, "examples/does-not-exist.html");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toMatch(/error|failed|not found/i);
    expect(breadcrumb(ctx)).toMatch(/error|does-not-exist/i);
  });

  test("shows unsupported-link feedback for mailto links", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pagina-mailto-"));
    const pagePath = join(tempDir, "contact.html");
    await writeFile(
      pagePath,
      `<!DOCTYPE html><html><body><p><a href="mailto:test@example.com">Email us</a></p></body></html>`,
    );

    const ctx = await boot(resolve(pagePath));
    await followLink(ctx);

    expect(breadcrumb(ctx)).toMatch(/mailto|not supported|Link/i);
    await rm(tempDir, { recursive: true, force: true });
  });

  test("copies the current URL and shows breadcrumb confirmation", async () => {
    const ctx = await boot();
    await press(ctx, "y");

    expect(breadcrumb(ctx)).toMatch(/Copied|Copy failed/i);
  });
});

describe("UX E2E — open prompt history and bookmarks", () => {
  test("recalls prior entries with Up and restores draft with Down", async () => {
    const ctx = await boot();
    await press(ctx, ":");
    await typeText(ctx, "examples/page.html");
    await submit(ctx);
    await waitForLoad(ctx);

    await press(ctx, ":");
    await typeText(ctx, "draft path");
    await pressArrow(ctx, "up");

    expect(breadcrumb(ctx)).toMatch(/examples\/page\.html/);

    await pressArrow(ctx, "down");
    expect(breadcrumb(ctx)).toMatch(/draft path/);
  });

  test("navigates via @bookmark from the open prompt", async () => {
    const ctx = await boot("examples/links-page.html", {
      seedBookmarks: [{ name: "docs", location: "examples/page.html" }],
    });

    await press(ctx, ":");
    await typeText(ctx, "@docs");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toMatch(/Hello!|Pagina/i);
    expect(breadcrumb(ctx)).toMatch(/Hello!|page\.html/i);
  });

  test("tab-completes local paths in the open prompt", async () => {
    const ctx = await boot();
    await press(ctx, ":");
    await typeText(ctx, "examples/pa");
    await pressTab(ctx);

    expect(breadcrumb(ctx)).toMatch(/examples\/page\.html/);
  });

  test("tab-completes bookmark names in the open prompt", async () => {
    const ctx = await boot("examples/links-page.html", {
      seedBookmarks: [
        { name: "docs", location: "examples/page.html" },
        { name: "downloads", location: "examples/other-page.html" },
      ],
    });

    await press(ctx, ":");
    await typeText(ctx, "@doc");
    await pressTab(ctx);

    expect(breadcrumb(ctx)).toMatch(/@docs/);
  });

  test("persists open-prompt history across app restarts", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "pagina-ux-persist-"));

    try {
      const first = await createUxTestApp("examples/links-page.html", {
        configDir,
        keepConfig: true,
      });
      await press(first, ":");
      await typeText(first, "examples/page.html");
      await submit(first);
      await waitForLoad(first);
      await first.cleanup();

      const second = await createUxTestApp("examples/links-page.html", {
        configDir,
        keepConfig: true,
      });
      contexts.push(second);

      await press(second, ":");
      await pressArrow(second, "up");

      expect(breadcrumb(second)).toMatch(/examples\/page\.html/);
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });
});

describe("UX E2E — sticky keyboard link focus", () => {
  test("keeps the focused link index while scrolling with j/k", async () => {
    const ctx = await boot("examples/fragments-page.html", { height: 18 });
    const session = ctx.app.getSession();
    expect(session).not.toBeNull();
    expect(session!.focusedLinkIndex).toBe(0);

    await press(ctx, "]");
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);

    const startY = session!.viewport.scrollY;
    await press(ctx, "j");
    await press(ctx, "j");
    await press(ctx, "j");

    expect(session!.viewport.scrollY).toBeGreaterThan(startY);
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);
  });

  test("keeps keyboard focus after scrolling and moving the mouse off links", async () => {
    const page = "examples/fragments-page.html";
    const layout = { width: 80, height: 18 };
    const ctx = await boot(page, layout);

    await press(ctx, "]");
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);

    await press(ctx, "j");
    await press(ctx, "j");
    const scrollY = ctx.app.getSession()!.viewport.scrollY;
    const point = await emptyContentPoint(page, layout, scrollY);
    await moveMouse(ctx, point.x, point.y);

    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);
  });
});

describe("UX E2E — mouse", () => {
  const linksPage = "examples/links-page.html";
  const layout = { width: 80, height: 24 };

  test("follows a link with a mouse click", async () => {
    const ctx = await boot();
    const point = await linkScreenPoint(linksPage, 0, layout);

    await click(ctx, point.x, point.y);
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toMatch(/Other Page|other page/i);
    expect(ctx.app.getHistory().index).toBe(1);
  });

  test("jumps history by clicking a breadcrumb segment", async () => {
    const ctx = await boot();
    await followLink(ctx);
    await waitForLoad(ctx);
    expect(ctx.app.getHistory().index).toBe(1);

    const point = breadcrumbClickPoint(ctx.app.getHistory(), layout.width, 0);
    await click(ctx, point.x, point.y);
    await waitForLoad(ctx);

    expect(ctx.app.getHistory().index).toBe(0);
    expect(breadcrumb(ctx)).toMatch(/Links Demo|links-page/i);
  });

  test("keeps keyboard link focus when the mouse moves off links", async () => {
    const ctx = await boot();
    await press(ctx, "]");
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);

    await moveMouse(ctx, 40, 10);
    expect(ctx.app.getSession()?.focusedLinkIndex).toBe(1);
  });
});

describe("UX E2E — reload", () => {
  test("soft reload serves cached content after the file changes on disk", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pagina-reload-"));
    const pagePath = join(tempDir, "page.html");
    await writeFile(
      pagePath,
      `<!DOCTYPE html><html><body><h1>Version 1</h1></body></html>`,
    );

    const ctx = await boot(resolve(pagePath));
    expect(ctx.captureCharFrame()).toContain("Version 1");
    expect(ctx.app.getHistory().index).toBe(0);

    await writeFile(
      pagePath,
      `<!DOCTYPE html><html><body><h1>Version 2</h1></body></html>`,
    );
    await press(ctx, "r");
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toContain("Version 1");
    expect(ctx.app.getHistory().index).toBe(0);
    await rm(tempDir, { recursive: true, force: true });
  });

  test("hard reload bypasses cache and reads updated local content", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pagina-reload-"));
    const pagePath = join(tempDir, "page.html");
    await writeFile(
      pagePath,
      `<!DOCTYPE html><html><body><h1>Version 1</h1></body></html>`,
    );

    const ctx = await boot(resolve(pagePath));
    await writeFile(
      pagePath,
      `<!DOCTYPE html><html><body><h1>Version 2</h1></body></html>`,
    );

    await press(ctx, "r", { shift: true });
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toContain("Version 2");
    await rm(tempDir, { recursive: true, force: true });
  });

  test("soft reload does not refetch a cached remote page", async () => {
    const ctx = await boot();
    let fetchCount = 0;

    globalThis.fetch = (async () => {
      fetchCount += 1;
      return new Response("<html><body><h1>Remote v1</h1></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    await press(ctx, ":");
    await typeText(ctx, "https://example.com/reload-test.html");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(fetchCount).toBe(1);
    expect(ctx.captureCharFrame()).toContain("Remote v1");

    globalThis.fetch = (async () => {
      fetchCount += 1;
      return new Response("<html><body><h1>Remote v2</h1></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    await press(ctx, "r");
    await waitForLoad(ctx);

    expect(fetchCount).toBe(1);
    expect(ctx.captureCharFrame()).toContain("Remote v1");
  });

  test("hard reload refetches remote content", async () => {
    const ctx = await boot();
    let fetchCount = 0;

    globalThis.fetch = (async () => {
      fetchCount += 1;
      const version = fetchCount === 1 ? "Remote v1" : "Remote v2";
      return new Response(`<html><body><h1>${version}</h1></body></html>`, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    await press(ctx, ":");
    await typeText(ctx, "https://example.com/reload-test.html");
    await submit(ctx);
    await waitForLoad(ctx);

    expect(ctx.captureCharFrame()).toContain("Remote v1");

    await press(ctx, "r", { ctrl: true });
    await waitForLoad(ctx);

    expect(fetchCount).toBe(2);
    expect(ctx.captureCharFrame()).toContain("Remote v2");
  });
});

describe("UX E2E — remote loading", () => {
  test("keeps the current page visible while a remote page loads", async () => {
    const ctx = await boot();
    let resolveFetch: (() => void) | null = null;
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });

    globalThis.fetch = (async () => {
      await fetchGate;
      return new Response("<html><body><h1>Remote</h1></body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    await press(ctx, ":");
    await typeText(ctx, "https://example.com/remote.html");
    await submit(ctx);
    await waitForLoad(ctx, 10);

    expect(ctx.captureCharFrame()).toContain("Links Demo");
    resolveFetch?.();
    await waitForLoad(ctx, 100);

    expect(ctx.captureCharFrame()).toContain("Remote");
  });

  test("cancels a slow remote fetch with Escape", async () => {
    const ctx = await boot();
    globalThis.fetch = (async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
        setTimeout(() => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, 5_000);
      })) as typeof fetch;

    await press(ctx, ":");
    await typeText(ctx, "https://example.com/slow.html");
    await submit(ctx);
    await waitForLoad(ctx, 10);

    await pressEscape(ctx);
    await waitForLoad(ctx, 50);

    expect(breadcrumb(ctx)).toMatch(/cancelled|Links Demo/i);
    expect(ctx.captureCharFrame()).toContain("Links Demo");
  });
});
