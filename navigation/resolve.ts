import { dirname, resolve } from "node:path";

function isRemoteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/** Resolve a local file path from a URL-like attribute against a page file path. */
export function resolveLocalPath(url: string, baseFilePath: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return null;
  if (isRemoteUrl(trimmed)) return null;

  const baseDir = dirname(resolve(baseFilePath));
  if (trimmed.startsWith("/")) {
    return resolve(trimmed);
  }

  return resolve(baseDir, trimmed);
}

/** Resolve an anchor href against the current page file path. */
export function resolveHref(href: string, baseFilePath: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:")) return null;
  if (trimmed.startsWith("#")) return null;

  if (isRemoteUrl(trimmed)) {
    throw new Error(`Remote URLs are not supported yet: ${trimmed}`);
  }

  return resolveLocalPath(trimmed, baseFilePath);
}
