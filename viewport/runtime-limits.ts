import {
  REMOTE_FETCH_MAX_BYTES,
  REMOTE_FETCH_MAX_REDIRECTS,
  REMOTE_FETCH_TIMEOUT_MS,
} from "../navigation/load";

function truncateLine(line: string, width: number): string {
  if (width <= 0) return "";
  if (line.length <= width) return line;
  if (width <= 3) return line.slice(0, width);
  return `${line.slice(0, width - 3)}...`;
}

function formatMaxBytes(bytes: number): string {
  if (bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MB`;
  }

  if (bytes % 1024 === 0) {
    return `${bytes / 1024} KB`;
  }

  return `${bytes} bytes`;
}

/** Help overlay bullets describing Pagina runtime limits and behavior. */
export function formatRuntimeLimitsHelpSection(width: number): string[] {
  const timeoutSeconds = REMOTE_FETCH_TIMEOUT_MS / 1000;
  const maxResponseSize = formatMaxBytes(REMOTE_FETCH_MAX_BYTES);

  const bullets = [
    `Remote fetch: ${timeoutSeconds} s timeout, ${maxResponseSize} max response, ${REMOTE_FETCH_MAX_REDIRECTS} redirects max`,
    "First load shows a dim loading screen; later navigations keep the current page visible",
    "Press Esc to cancel slow remote fetches",
    "r reloads from cache when available; R / Ctrl+R bypasses cache",
    "Unsupported links: mailto:, tel:, data:, javascript:, empty hrefs, bare #",
  ];

  const lines = ["", "Limits & behavior:"];
  for (const bullet of bullets) {
    lines.push(truncateLine(`  • ${bullet}`, width));
  }

  return lines;
}
