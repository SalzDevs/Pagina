import { resolve } from "node:path";

import { isRemoteUrl, resolveResource, resolveAgainstBase, isUnsupportedLinkScheme } from "./resolve";

export const EMPTY_LINK_LABEL = "(empty link)";

export interface LinkTarget {
  /** Resolved page location when a navigation fetch is needed. */
  location: string | null;
  /** Element id to scroll to after the page is shown. */
  fragment: string | null;
}

export interface PageLocationParts {
  location: string;
  fragment: string | null;
}

/** Split a page location or CLI argument into base location and optional fragment. */
export function splitPageLocation(input: string): PageLocationParts {
  const trimmed = input.trim();
  const hashIndex = trimmed.indexOf("#");

  if (hashIndex === -1) {
    return { location: trimmed, fragment: null };
  }

  const location = trimmed.slice(0, hashIndex);
  const fragment = trimmed.slice(hashIndex + 1);

  return {
    location: location || trimmed.slice(0, hashIndex),
    fragment: fragment.length > 0 ? fragment : null,
  };
}

function normalizeComparableLocation(location: string): string {
  const withoutHash = location.split("#")[0] ?? location;
  if (isRemoteUrl(withoutHash)) {
    return withoutHash;
  }

  return resolve(withoutHash);
}

/** True when two locations refer to the same page (ignoring fragments). */
export function isSamePage(left: string, right: string): boolean {
  return normalizeComparableLocation(left) === normalizeComparableLocation(right);
}

/** When non-null, the href cannot be followed and this label belongs in the breadcrumb. */
export function unfollowableLinkLabel(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return EMPTY_LINK_LABEL;
  if (trimmed === "#") return "#";
  if (trimmed.startsWith("javascript:")) return trimmed;
  if (isUnsupportedLinkScheme(trimmed)) return trimmed;
  return null;
}

export function isActionableLinkTarget(target: LinkTarget): boolean {
  return target.location !== null || target.fragment !== null;
}

/** Parse an anchor href into a navigation target. */
export function parseLinkTarget(
  href: string,
  documentBase: string,
  pageLocation: string = documentBase,
): LinkTarget | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || isUnsupportedLinkScheme(trimmed)) {
    return null;
  }

  if (trimmed === "#") {
    return { location: null, fragment: null };
  }

  const hashIndex = trimmed.indexOf("#");
  if (hashIndex === -1) {
    const location = resolveAgainstBase(trimmed, documentBase, pageLocation);
    return location ? { location, fragment: null } : null;
  }

  const pathPart = trimmed.slice(0, hashIndex);
  const fragmentPart = trimmed.slice(hashIndex + 1);

  if (hashIndex === 0) {
    return { location: null, fragment: fragmentPart.length > 0 ? fragmentPart : null };
  }

  const location = pathPart
    ? resolveAgainstBase(pathPart, documentBase, pageLocation)
    : pageLocation.split("#")[0] ?? pageLocation;
  if (!location) return null;

  return {
    location,
    fragment: fragmentPart.length > 0 ? fragmentPart : null,
  };
}
