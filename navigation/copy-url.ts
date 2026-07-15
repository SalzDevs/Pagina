/** Build the text copied for the current page URL. */
export function formatPageCopyUrl(
  pageLocation: string,
  options: {
    detailed?: boolean;
    fragment?: string | null;
    scrollY?: number;
  } = {},
): string {
  if (!options.detailed) return pageLocation;

  let url = pageLocation;
  const fragment = options.fragment?.trim();
  if (fragment) {
    url += `#${fragment}`;
  }

  const scrollY = options.scrollY ?? 0;
  if (scrollY > 0) {
    url += ` (line ${scrollY + 1})`;
  }

  return url;
}
