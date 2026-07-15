import { basename } from "node:path";

import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { EMPTY_LINK_LABEL } from "./fragment";
import { isRemoteUrl } from "./resolve";
import { ERROR_PAGE_TITLE } from "./error-page";

export interface HistoryEntry {
  location: string;
  label: string;
  scrollY?: number;
  focusedLinkIndex?: number | null;
  fragment?: string | null;
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

/** Persist view state on the active history entry before navigating away. */
export function updateCurrentHistoryEntry(
  history: BrowserHistory,
  patch: Pick<HistoryEntry, "scrollY" | "focusedLinkIndex" | "fragment">,
): BrowserHistory {
  if (history.index < 0) return history;

  const current = history.entries[history.index];
  if (!current) return history;

  const entries = history.entries.slice();
  entries[history.index] = { ...current, ...patch };

  return { ...history, entries };
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

export function goToHistoryIndex(
  history: BrowserHistory,
  index: number,
): {
  history: BrowserHistory;
  entry: HistoryEntry | null;
} {
  if (index < 0 || index >= history.entries.length) {
    return { history, entry: null };
  }

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
  let title: string | undefined;
  let h1: string | undefined;
  let h2: string | undefined;

  const elementText = (node: Node): string | undefined => {
    const parts: string[] = [];

    const walk = (current: Node): void => {
      if (current.type === NodeType.Text) {
        parts.push(current.value ?? "");
        return;
      }

      for (const child of current.children ?? []) {
        walk(child);
      }
    };

    walk(node);
    const text = parts.join("").replace(/\s+/g, " ").trim();
    return text || undefined;
  };

  const walk = (node: Node): void => {
    if (node.type === NodeType.Element) {
      if (node.tag === "title" && !title) {
        title = elementText(node);
      } else if (node.tag === "h1" && !h1) {
        h1 = elementText(node);
      } else if (node.tag === "h2" && !h2) {
        h2 = elementText(node);
      }
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  walk(root);
  return title ?? h1 ?? h2;
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

/** True when the page title matches Pagina's generated error page. */
export function isErrorPageTitle(title?: string): boolean {
  return title?.trim() === ERROR_PAGE_TITLE;
}

/** Build a breadcrumb label for a failed navigation. */
export function formatErrorHistoryLabel(location: string): string {
  return `⚠ ${historyLabel(location)}`;
}

/** Choose a history label for a loaded page. */
export function historyEntryLabel(
  location: string,
  title?: string,
  options: { isErrorPage?: boolean } = {},
): string {
  if (options.isErrorPage || isErrorPageTitle(title)) {
    return formatErrorHistoryLabel(location);
  }

  return historyLabel(location, title);
}

export interface BreadcrumbSegment {
  index: number;
  label: string;
  start: number;
  end: number;
}

export interface BreadcrumbLayout {
  text: string;
  segments: BreadcrumbSegment[];
  ellipsis: { start: number; end: number } | null;
}

function breadcrumbDisplayLabel(entry: HistoryEntry, index: number, currentIndex: number): string {
  return index === currentIndex ? `[${entry.label}]` : entry.label;
}

/** Lay out the history trail and record clickable segment ranges. */
export function layoutBreadcrumb(history: BrowserHistory, width: number): BreadcrumbLayout {
  if (history.entries.length === 0 || history.index < 0) {
    return { text: "", segments: [], ellipsis: null };
  }

  const separator = " › ";
  const labels = history.entries.map((entry, index) =>
    breadcrumbDisplayLabel(entry, index, history.index),
  );

  let visibleStart = 0;
  let visible = [...labels];

  while (visible.length > 1) {
    const candidate = visible.join(separator);
    if (candidate.length <= width) break;
    visibleStart++;
    visible = labels.slice(visibleStart);
  }

  let text: string;
  let ellipsis: BreadcrumbLayout["ellipsis"] = null;

  if (visible.length === 1) {
    const single = visible[0] ?? "";
    if (single.length <= width) {
      text = visibleStart > 0 ? `...${separator}${single}` : single;
      if (visibleStart > 0) {
        ellipsis = { start: 0, end: 3 };
      }
    } else {
      text = single.slice(0, Math.max(0, width - 3)) + "...";
    }
  } else {
    text = visible.join(separator);
  }

  const segments: BreadcrumbSegment[] = [];
  let searchFrom = ellipsis ? ellipsis.end + separator.length : 0;

  for (let index = visibleStart; index < labels.length; index++) {
    const label = labels[index]!;
    const start = text.indexOf(label, searchFrom);
    if (start === -1) continue;

    segments.push({
      index,
      label,
      start,
      end: start + label.length,
    });
    searchFrom = start + label.length;
  }

  return { text, segments, ellipsis };
}

/** Resolve a breadcrumb column to a history index or picker action. */
export function historyTargetAtBreadcrumbColumn(
  layout: BreadcrumbLayout,
  column: number,
): number | "picker" | null {
  if (column < 0 || column >= layout.text.length) return null;

  if (layout.ellipsis && column >= layout.ellipsis.start && column < layout.ellipsis.end) {
    return "picker";
  }

  for (const segment of layout.segments) {
    if (column >= segment.start && column < segment.end) {
      return segment.index;
    }
  }

  return null;
}

/** Format the history trail for the breadcrumb bar. */
export function formatBreadcrumb(history: BrowserHistory, width: number): string {
  return layoutBreadcrumb(history, width).text;
}

function cssWarningLabel(url: string): string {
  return historyLabel(url);
}

function minimalCssStatusVariants(warnings: string[]): string[] {
  if (warnings.length === 1) {
    return [" |⚠CSS", " |⚠", "⚠"];
  }

  const count = warnings.length;
  return [` |⚠CSS×${count}`, ` |⚠×${count}`, " |⚠", "⚠"];
}

function cssWarningStatusVariants(warnings: string[]): string[] {
  if (warnings.length === 1) {
    const label = cssWarningLabel(warnings[0]!);
    return [` | ⚠ CSS failed: ${label}`, " | ⚠ CSS failed", " | ⚠ CSS", ...minimalCssStatusVariants(warnings)];
  }

  return [
    ` | ⚠ ${warnings.length} CSS files failed`,
    ` | ⚠ CSS×${warnings.length}`,
    ...minimalCssStatusVariants(warnings),
  ];
}

/** Format failed stylesheet URLs for the help overlay. */
export function formatCssWarningHelpSection(warnings: string[], width: number): string[] {
  if (warnings.length === 0) return [];

  const lines = ["", "Failed stylesheets:"];

  for (const url of warnings) {
    const label = cssWarningLabel(url);
    const primary =
      label.length <= width - 4
        ? label
        : `${label.slice(0, Math.max(0, width - 7))}...`;
    lines.push(`  • ${primary}`);

    if (url !== label) {
      const detail =
        url.length <= width - 4 ? url : `${url.slice(0, Math.max(0, width - 7))}...`;
      if (detail !== primary) {
        lines.push(`    ${detail}`);
      }
    }
  }

  lines.push("", "Press ? to close this screen.");
  return lines.map((line) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 3))}...`));
}

function truncateStatus(status: string, width: number): string {
  if (status.length <= width) return status;
  return status.slice(0, Math.max(0, width - 3)) + "...";
}

/** Append CSS load failure status to a breadcrumb when stylesheets failed. */
export function formatCssWarningStatus(warnings: string[], width: number): string {
  if (warnings.length === 0) return "";

  const variants = cssWarningStatusVariants(warnings);
  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return truncateStatus(variants[variants.length - 1]!, width);
}

/** Append fragment-not-found status to a breadcrumb when an anchor is missing. */
export function formatFragmentNotFoundStatus(fragment: string, width: number): string {
  const variants = [` | ⚠ #${fragment} not found`, " | ⚠ Fragment not found", " | ⚠"];

  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return truncateStatus(variants[variants.length - 1]!, width);
}

/** Append unsupported-link status to a breadcrumb when a link cannot be followed. */
export function formatUnsupportedLinkStatus(href: string, width: number): string {
  const trimmed = href.trim();
  const genericVariants = [" | ⚠ Link not supported", " | ⚠"];

  if (!trimmed || trimmed === EMPTY_LINK_LABEL || trimmed === "#") {
    for (const status of genericVariants) {
      if (status.length <= width) return status;
    }
    return truncateStatus(genericVariants[genericVariants.length - 1]!, width);
  }

  const scheme = trimmed.split(":")[0]?.toLowerCase() ?? "link";
  const variants = [` | ⚠ ${scheme}: links not supported`, ...genericVariants];

  for (const status of variants) {
    if (status.length <= width) return status;
  }

  return truncateStatus(variants[variants.length - 1]!, width);
}

function appendBreadcrumbStatus(
  history: BrowserHistory,
  width: number,
  status: string,
): string {
  const breadcrumbWidth = width - status.length;
  if (breadcrumbWidth >= 0) {
    return formatBreadcrumb(history, breadcrumbWidth) + status;
  }

  return formatBreadcrumb(history, width);
}

/** Format the history trail and any CSS load warnings for the breadcrumb bar. */
export function formatBreadcrumbWithStatus(
  history: BrowserHistory,
  width: number,
  options: {
    cssWarnings?: string[];
    fragmentNotFound?: string | null;
    unsupportedLink?: string | null;
  } = {},
): string {
  const fragment = options.fragmentNotFound ?? null;
  if (fragment) {
    return appendBreadcrumbStatus(history, width, formatFragmentNotFoundStatus(fragment, width));
  }

  const unsupportedLink = options.unsupportedLink ?? null;
  if (unsupportedLink) {
    return appendBreadcrumbStatus(
      history,
      width,
      formatUnsupportedLinkStatus(unsupportedLink, width),
    );
  }

  const warnings = options.cssWarnings ?? [];
  if (warnings.length === 0) return formatBreadcrumb(history, width);

  const breadcrumbOnly = formatBreadcrumb(history, width);
  let best = breadcrumbOnly;
  let bestBreadcrumbLength = breadcrumbOnly.length;

  for (const status of cssWarningStatusVariants(warnings)) {
    const breadcrumbWidth = width - status.length;
    if (breadcrumbWidth < 0) continue;

    const breadcrumb = formatBreadcrumb(history, breadcrumbWidth);
    const combined = breadcrumb + status;
    if (combined.length > width) continue;

    if (
      breadcrumb.length > bestBreadcrumbLength ||
      (breadcrumb.length === bestBreadcrumbLength && combined.length > best.length)
    ) {
      best = combined;
      bestBreadcrumbLength = breadcrumb.length;
    }
  }

  if (best.includes("⚠")) return best;

  for (const status of minimalCssStatusVariants(warnings)) {
    const breadcrumbWidth = width - status.length;
    if (breadcrumbWidth < 0) continue;

    const breadcrumb = formatBreadcrumb(history, breadcrumbWidth);
    const combined = breadcrumb + status;
    if (combined.length <= width) return combined;
  }

  if (width >= 1) {
    return `${formatBreadcrumb(history, Math.max(0, width - 1)).slice(0, Math.max(0, width - 1))}⚠`;
  }

  return best;
}

/** Format a breadcrumb loading label while a page is being fetched. */
export function formatLoadingBreadcrumb(
  location: string,
  width: number,
  options: { cancellable?: boolean } = {},
): string {
  const label = historyLabel(location);
  let text = `Loading ${label}…`;
  if (options.cancellable) {
    text += " (Esc to cancel)";
  }

  if (text.length <= width) return text;

  return text.slice(0, Math.max(0, width - 3)) + "...";
}

/** Format a breadcrumb label after the user cancels a page load. */
export function formatLoadCancelledBreadcrumb(width: number): string {
  const text = "Loading cancelled";
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width - 3)) + "...";
}
