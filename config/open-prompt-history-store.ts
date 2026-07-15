import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { openPromptHistoryPath } from "./paths";
import { OpenPromptHistory } from "../viewport/open-prompt-history";

interface HistoryFile {
  entries?: unknown;
}

function normalizeHistoryEntries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const entries: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    entries.push(trimmed);
  }

  return entries;
}

/** Load persisted open-prompt history entries. */
export async function loadOpenPromptHistory(): Promise<string[]> {
  const file = Bun.file(openPromptHistoryPath());
  if (!(await file.exists())) return [];

  try {
    const data = (await file.json()) as HistoryFile;
    return normalizeHistoryEntries(data.entries);
  } catch {
    return [];
  }
}

/** Persist open-prompt history entries. */
export async function saveOpenPromptHistory(entries: readonly string[]): Promise<void> {
  const path = openPromptHistoryPath();
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, `${JSON.stringify({ entries: [...entries] }, null, 2)}\n`);
}

/** Create an open-prompt history that loads from and saves to disk. */
export async function createPersistentOpenPromptHistory(): Promise<OpenPromptHistory> {
  const initial = await loadOpenPromptHistory();

  return new OpenPromptHistory({
    initial,
    onChange: (entries) => {
      void saveOpenPromptHistory(entries);
    },
  });
}
