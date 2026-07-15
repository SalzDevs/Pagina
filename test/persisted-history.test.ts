import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPersistentOpenPromptHistory,
  loadOpenPromptHistory,
  saveOpenPromptHistory,
} from "../config/open-prompt-history-store";
import { openPromptHistoryPath } from "../config/paths";

let configDir = "";

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), "pagina-config-"));
  process.env.PAGINA_CONFIG_DIR = configDir;
});

afterEach(async () => {
  delete process.env.PAGINA_CONFIG_DIR;
  await rm(configDir, { recursive: true, force: true });
});

describe("persisted open-prompt history", () => {
  test("loads and saves history entries across sessions", async () => {
    await saveOpenPromptHistory(["examples/page.html", "examples/links-page.html"]);

    expect(await loadOpenPromptHistory()).toEqual([
      "examples/page.html",
      "examples/links-page.html",
    ]);
    expect(openPromptHistoryPath()).toBe(join(configDir, "history.json"));
  });

  test("loads saved entries when creating persistent history", async () => {
    await saveOpenPromptHistory(["examples/page.html", "examples/links-page.html"]);

    const history = await createPersistentOpenPromptHistory();
    expect(history.length).toBe(2);
    expect(history.get(0)).toBe("examples/page.html");
    expect(history.get(1)).toBe("examples/links-page.html");
  });
});
