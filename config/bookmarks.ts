import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { pathTokenAtCursor } from "../viewport/open-prompt-path";
import { bookmarksPath } from "./paths";

export interface Bookmark {
  name: string;
  location: string;
}

interface BookmarksFile {
  bookmarks?: unknown;
}

function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return [];

  const bookmarks: Bookmark[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const name = "name" in item && typeof item.name === "string" ? item.name.trim() : "";
    const location =
      "location" in item && typeof item.location === "string" ? item.location.trim() : "";

    if (name.length === 0 || location.length === 0) continue;
    if (bookmarks.some((bookmark) => bookmark.name === name)) continue;

    bookmarks.push({ name, location });
  }

  return bookmarks;
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;

  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) return "";
    }
  }

  return prefix;
}

/** Named bookmarks reachable from the open prompt via @name. */
export class BookmarkStore {
  private readonly bookmarks: Bookmark[];

  constructor(bookmarks: Bookmark[] = []) {
    this.bookmarks = [...bookmarks];
  }

  get names(): readonly string[] {
    return this.bookmarks.map((bookmark) => bookmark.name);
  }

  toArray(): readonly Bookmark[] {
    return [...this.bookmarks];
  }

  /** Resolve @name or @name#fragment input to a page location. */
  resolveInput(value: string): { location: string; fragment: string | null } | null {
    const trimmed = value.trim();
    if (!trimmed.startsWith("@")) return null;

    const rest = trimmed.slice(1);
    const hashIndex = rest.indexOf("#");
    const name = (hashIndex === -1 ? rest : rest.slice(0, hashIndex)).trim();
    if (name.length === 0) return null;

    const bookmark = this.bookmarks.find((entry) => entry.name === name);
    if (!bookmark) return null;

    const fragment =
      hashIndex === -1 ? null : rest.slice(hashIndex + 1).length > 0 ? rest.slice(hashIndex + 1) : null;

    return {
      location: bookmark.location,
      fragment,
    };
  }

  /** Tab-complete an @bookmark token within the prompt value. */
  completeToken(
    value: string,
    cursor: number,
  ): { value: string; cursor: number } | null {
    const { tokenStart, token } = pathTokenAtCursor(value, cursor);
    if (!token.startsWith("@") || token.length <= 1) return null;

    const partial = token.slice(1);
    const matches = this.bookmarks
      .map((bookmark) => bookmark.name)
      .filter((name) => name.startsWith(partial));

    if (matches.length === 0) return null;

    let completedName: string;
    if (matches.length === 1) {
      completedName = matches[0]!;
    } else {
      const shared = longestCommonPrefix(matches);
      if (shared.length <= partial.length) return null;
      completedName = shared;
    }

    const completedToken = `@${completedName}`;
    const nextValue = value.slice(0, tokenStart) + completedToken + value.slice(cursor);
    const nextCursor = tokenStart + completedToken.length;

    if (nextValue === value && nextCursor === cursor) return null;

    return { value: nextValue, cursor: nextCursor };
  }
}

/** Load bookmarks from the user config file. */
export async function loadBookmarkStore(): Promise<BookmarkStore> {
  const file = Bun.file(bookmarksPath());
  if (!(await file.exists())) return new BookmarkStore();

  try {
    const data = (await file.json()) as BookmarksFile;
    return new BookmarkStore(normalizeBookmarks(data.bookmarks));
  } catch {
    return new BookmarkStore();
  }
}

/** Save bookmarks to the user config file. */
export async function saveBookmarkStore(store: BookmarkStore): Promise<void> {
  const path = bookmarksPath();
  await mkdir(dirname(path), { recursive: true });
  const payload = {
    bookmarks: store.toArray(),
  };

  await Bun.write(path, `${JSON.stringify(payload, null, 2)}\n`);
}
