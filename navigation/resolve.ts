import { dirname, resolve } from "node:path";

/** True when the value is an http(s) URL. */
export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Resolve a href or resource URL against the current page location. */
export function resolveResource(url: string, pageLocation: string): string | null {
  return resolveAgainstBase(url, pageLocation, pageLocation);
}

/** Resolve a relative URL against an explicit document base. */
export function resolveAgainstBase(
  url: string,
  documentBase: string,
  pageLocation: string = documentBase,
): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return null;

  if (isRemoteUrl(trimmed)) {
    return trimmed;
  }

  if (isRemoteUrl(documentBase)) {
    return new URL(trimmed, documentBase).href;
  }

  const basePath = resolve(documentBase);
  const pagePath = resolve(pageLocation.split("#")[0] ?? pageLocation);
  const usesDirectoryBase = basePath !== pagePath;

  if (trimmed.startsWith("/")) {
    return resolve(trimmed);
  }

  const baseDir = usesDirectoryBase ? basePath : dirname(basePath);
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
