import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { BookmarkStore, loadBookmarkStore, saveBookmarkStore } from "../config/bookmarks";

let configDir = "";

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), "pagina-config-"));
  process.env.PAGINA_CONFIG_DIR = configDir;
});

afterEach(async () => {
  delete process.env.PAGINA_CONFIG_DIR;
  await rm(configDir, { recursive: true, force: true });
});

describe("BookmarkStore", () => {
  test("resolves bookmark names and optional fragments", () => {
    const store = new BookmarkStore([
      { name: "docs", location: "examples/page.html" },
      { name: "links", location: "examples/links-page.html" },
    ]);

    expect(store.resolveInput("@docs")).toEqual({
      location: "examples/page.html",
      fragment: null,
    });
    expect(store.resolveInput("@links#intro")).toEqual({
      location: "examples/links-page.html",
      fragment: "intro",
    });
    expect(store.resolveInput("@missing")).toBeNull();
    expect(store.resolveInput("examples/page.html")).toBeNull();
  });

  test("tab-completes bookmark names after @", () => {
    const store = new BookmarkStore([
      { name: "docs", location: "examples/page.html" },
      { name: "downloads", location: "examples/other-page.html" },
    ]);

    expect(store.completeToken("@doc", 4)).toEqual({
      value: "@docs",
      cursor: 5,
    });
    expect(store.completeToken("@dow", 4)).toEqual({
      value: "@downloads",
      cursor: 10,
    });
    expect(store.completeToken("@do", 3)).toBeNull();
  });

  test("loads and saves bookmarks from the config file", async () => {
    const store = new BookmarkStore([{ name: "docs", location: "examples/page.html" }]);
    await saveBookmarkStore(store);

    const loaded = await loadBookmarkStore();
    expect(loaded.resolveInput("@docs")).toEqual({
      location: "examples/page.html",
      fragment: null,
    });
  });
});
