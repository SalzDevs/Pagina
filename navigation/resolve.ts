import { dirname, resolve } from "node:path";

/** Resolve an anchor href against the current page file path. */
export function resolveHref(href: string, baseFilePath: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:")) return null;
  if (trimmed.startsWith("#")) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    throw new Error(`Remote URLs are not supported yet: ${trimmed}`);
  }

  const baseDir = dirname(resolve(baseFilePath));
  if (trimmed.startsWith("/")) {
    return resolve(trimmed);
  }

  return resolve(baseDir, trimmed);
}
