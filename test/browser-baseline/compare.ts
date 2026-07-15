import { collapseComparableText } from "../render-compare/compare";

export const BASELINE_PAGES = [
  "examples/page.html",
  "examples/links-page.html",
  "examples/fixtures/blog-post.html",
  "examples/fixtures/docs-page.html",
] as const;

export function normalizeComparableWords(text: string): string[] {
  return collapseComparableText(text).match(/[a-z0-9]+/g) ?? [];
}

/** Share of reference words that appear in the actual output. */
export function wordCoverage(referenceWords: string[], actualWords: string[]): number {
  if (referenceWords.length === 0) return 1;

  const actualSet = new Set(actualWords);
  const missing = referenceWords.filter((word) => !actualSet.has(word));
  return (referenceWords.length - missing.length) / referenceWords.length;
}

export function formatWordDiff(
  label: string,
  referenceWords: string[],
  actualWords: string[],
  limit = 12,
): string {
  const actualSet = new Set(actualWords);
  const missing = referenceWords.filter((word) => !actualSet.has(word));
  return `${label}: missing ${missing.length} word(s)${missing.length > 0 ? `: ${missing.slice(0, limit).join(", ")}` : ""}`;
}
