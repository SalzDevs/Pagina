import { formatCssWarningHelpSection } from "../navigation/history";

export interface KeybindingEntry {
  keys: string;
  description: string;
}

/** Canonical list of Pagina keyboard and mouse bindings. */
export const PAGINA_KEYBINDINGS: KeybindingEntry[] = [
  { keys: "↑ / ↓, j / k", description: "Scroll one line" },
  { keys: "← / →, h / l", description: "Scroll one column" },
  { keys: "PgUp / PgDn", description: "Scroll one page" },
  { keys: "Home / End, g / G", description: "Jump to top / bottom" },
  { keys: "[ / ]", description: "Previous / next link" },
  { keys: "Enter, o", description: "Follow focused link" },
  { keys: "u", description: "Back" },
  { keys: "U (Shift+u)", description: "Forward" },
  { keys: "r", description: "Soft reload (from cache)" },
  { keys: "R, Ctrl+R", description: "Hard reload (bypass cache)" },
  { keys: "y", description: "Copy current URL" },
  { keys: "Y (Shift+y)", description: "Copy URL with fragment and scroll context" },
  { keys: "b", description: "Browse history (picker)" },
  { keys: "Click breadcrumb", description: "Jump to entry or open history picker" },
  { keys: "Option+← / →", description: "Back / forward (macOS)" },
  { keys: "Mouse wheel", description: "Scroll page" },
  { keys: "Mouse hover", description: "Focus link under cursor" },
  { keys: "Mouse click", description: "Follow link under cursor" },
  { keys: ":", description: "Open a URL or file path" },
  { keys: "@name", description: "Open a saved bookmark from the open prompt" },
  { keys: "/, Ctrl+F", description: "Search in page" },
  { keys: "n / N", description: "Next / previous search match" },
  { keys: "Tab, ↑/↓, Ctrl+A/E", description: "Edit open prompt (complete, history, jump)" },
  { keys: "?", description: "Toggle help" },
  { keys: "Ctrl+C", description: "Quit" },
];

export function formatKeybindingLine(entry: KeybindingEntry, width: number): string {
  const separator = "  ";
  const minGap = 2;
  const maxKeysWidth = Math.min(24, Math.max(12, Math.floor(width * 0.35)));
  const keys = entry.keys.padEnd(maxKeysWidth);
  const available = width - keys.length - minGap;

  if (available <= 0) {
    return entry.keys.slice(0, Math.max(0, width - 3)) + "...";
  }

  const description =
    entry.description.length <= available
      ? entry.description
      : entry.description.slice(0, Math.max(0, available - 3)) + "...";

  return `${keys}${separator}${description}`;
}

/** Format help overlay lines for the current terminal width. */
export function formatHelpLines(
  width: number,
  options: { cssWarnings?: string[] } = {},
): string[] {
  const title = "Pagina — keyboard & mouse";
  const hint = "Press ? to close";

  const lines: string[] = [title, ""];

  for (const entry of PAGINA_KEYBINDINGS) {
    lines.push(formatKeybindingLine(entry, width));
  }

  lines.push("", "On Linux/Windows, use u / U for back and forward.");

  if (options.cssWarnings?.length) {
    lines.push(...formatCssWarningHelpSection(options.cssWarnings, width));
  } else {
    lines.push("", hint);
  }

  return lines;
}
