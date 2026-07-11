import { basename } from "node:path";

import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { isRemoteUrl } from "./resolve";

export interface HistoryEntry {
  location: string;
  label: string;
}

export interface BrowserHistory {
  entries: HistoryEntry[];
  index: number;
}

export function createBrowserHistory(): BrowserHistory {
  return { entries: [], index: -1 };
}

export function pushHistory(history: BrowserHistory, entry: HistoryEntry): BrowserHistory {
  const entries = history.entries.slice(0, history.index + 1);
  entries.push(entry);

  return {
    entries,
    index: entries.length - 1,
  };
}

export function goBack(history: BrowserHistory): {
  history: BrowserHistory;
  entry: HistoryEntry | null;
} {
  if (history.index <= 0) {
    return { history, entry: null };
  }

  const index = history.index - 1;
  return {
    history: { ...history, index },
    entry: history.entries[index] ?? null,
  };
}

export function goForward(history: BrowserHistory): {
  history: BrowserHistory;
  entry: HistoryEntry | null;
} {
  if (history.index >= history.entries.length - 1) {
    return { history, entry: null };
  }

  const index = history.index + 1;
  return {
    history: { ...history, index },
    entry: history.entries[index] ?? null,
  };
}

export function canGoBack(history: BrowserHistory): boolean {
  return history.index > 0;
}

export function canGoForward(history: BrowserHistory): boolean {
  return history.index >= 0 && history.index < history.entries.length - 1;
}

/** Extract the document title from a DOM tree, if present. */
export function extractPageTitle(root: Node): string | undefined {
  const walk = (node: Node): string | undefined => {
    if (node.type === NodeType.Element && node.tag === "title") {
      const text = node.children
        ?.filter((child) => child.type === NodeType.Text)
        .map((child) => child.value ?? "")
        .join("")
        .trim();

      return text || undefined;
    }

    for (const child of node.children ?? []) {
      const title = walk(child);
      if (title) return title;
    }

    return undefined;
  };

  return walk(root);
}

/** Build a short breadcrumb label from a page location and optional title. */
export function historyLabel(location: string, title?: string): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) return trimmedTitle;

  if (isRemoteUrl(location)) {
    const url = new URL(location);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname}${path}`;
  }

  return basename(location);
}

/** Format the history trail for the breadcrumb bar. */
export function formatBreadcrumb(history: BrowserHistory, width: number): string {
  if (history.entries.length === 0 || history.index < 0) return "";

  const separator = " › ";
  const labels = history.entries.map((entry, index) =>
    index === history.index ? `[${entry.label}]` : entry.label,
  );

  const join = (parts: string[]) => parts.join(separator);
  let parts = [...labels];

  while (parts.length > 1) {
    const candidate = join(parts);
    if (candidate.length <= width) return candidate;

    parts = parts.slice(1);
  }

  const single = parts[0] ?? "";
  if (single.length <= width) {
    return parts.length < labels.length ? `...${separator}${single}` : single;
  }

  return single.slice(0, Math.max(0, width - 3)) + "...";
}
