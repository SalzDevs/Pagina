import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { isRemoteUrl } from "../navigation/resolve";

/** Expand a leading tilde to the user home directory. */
export function expandTilde(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
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

function appendDirectorySlash(dirPath: string, name: string): string {
  try {
    if (statSync(resolve(dirPath, name)).isDirectory()) {
      return `${name}/`;
    }
  } catch {
    // Ignore missing stat errors during completion.
  }

  return name;
}

/** Return the path token ending at the cursor for tab completion. */
export function pathTokenAtCursor(value: string, cursor: number): {
  tokenStart: number;
  token: string;
} {
  const before = value.slice(0, cursor);
  const tokenStart = Math.max(before.lastIndexOf(" "), before.lastIndexOf("\t"), -1) + 1;
  return {
    tokenStart,
    token: before.slice(tokenStart),
  };
}

/** Tab-complete a local path token within the prompt value. */
export function completeLocalPath(
  value: string,
  cursor: number,
  cwd: string = process.cwd(),
): { value: string; cursor: number } | null {
  const { tokenStart, token } = pathTokenAtCursor(value, cursor);
  if (token.length === 0 || isRemoteUrl(token)) return null;

  const expanded = expandTilde(token);
  const slashIndex = expanded.lastIndexOf("/");
  const partial = slashIndex === -1 ? expanded : expanded.slice(slashIndex + 1);
  const dirToken = slashIndex === -1 ? "" : expanded.slice(0, slashIndex + 1);
  const dirPath = slashIndex === -1 ? cwd : resolve(cwd, dirToken);

  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return null;
  }

  const matches = entries.filter((entry) => entry.startsWith(partial));
  if (matches.length === 0) return null;

  let completedPartial: string;
  if (matches.length === 1) {
    completedPartial = appendDirectorySlash(dirPath, matches[0]!);
  } else {
    const shared = longestCommonPrefix(matches);
    if (shared.length <= partial.length) return null;
    completedPartial = shared;
  }

  const completedToken = `${dirToken}${completedPartial}`;
  const nextValue = value.slice(0, tokenStart) + completedToken + value.slice(cursor);
  const nextCursor = tokenStart + completedToken.length;

  if (nextValue === value && nextCursor === cursor) return null;

  return { value: nextValue, cursor: nextCursor };
}
