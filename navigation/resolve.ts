import { dirname, resolve } from "node:path";

/** True when the value is an http(s) URL. */
export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Resolve a href or resource URL against the current page location. */
export function resolveResource(url: string, pageLocation: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return null;

  if (isRemoteUrl(trimmed)) {
    return trimmed;
  }

  if (isRemoteUrl(pageLocation)) {
    return new URL(trimmed, pageLocation).href;
  }

  const baseDir = dirname(resolve(pageLocation));
  if (trimmed.startsWith("/")) {
    return resolve(trimmed);
  }

  return resolve(baseDir, trimmed);
}

/** Resolve an anchor href against the current page location. */
export function resolveHref(href: string, pageLocation: string): string | null {
  return resolveResource(href, pageLocation);
}

/** @deprecated Use resolveResource instead. */
export function resolveLocalPath(url: string, baseFilePath: string): string | null {
  if (isRemoteUrl(url) || isRemoteUrl(baseFilePath)) {
    return resolveResource(url, baseFilePath);
  }

  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return null;

  const baseDir = dirname(resolve(baseFilePath));
  if (trimmed.startsWith("/")) {
    return resolve(trimmed);
  }

  return resolve(baseDir, trimmed);
}
