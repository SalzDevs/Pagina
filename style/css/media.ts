export interface MediaContext {
  viewportWidth: number;
  viewportHeight?: number;
}

export const DEFAULT_MEDIA_CONTEXT: MediaContext = { viewportWidth: 80, viewportHeight: 24 };

function mediaLengthToColumns(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)(px|ch|em|rem)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;

  switch ((match[2] ?? "px").toLowerCase()) {
    case "ch":
      return amount;
    case "px":
      return amount;
    case "em":
    case "rem":
      return amount * 16;
    default:
      return null;
  }
}

function matchesMediaFeature(feature: string, context: MediaContext): boolean {
  const trimmed = feature.trim().toLowerCase();
  if (trimmed === "screen" || trimmed === "all") return true;
  if (trimmed === "print") return false;

  const minWidth = trimmed.match(/^\(\s*min-width\s*:\s*([^)]+)\)$/);
  if (minWidth) {
    const columns = mediaLengthToColumns(minWidth[1]!);
    return columns !== null && context.viewportWidth >= columns;
  }

  const maxWidth = trimmed.match(/^\(\s*max-width\s*:\s*([^)]+)\)$/);
  if (maxWidth) {
    const columns = mediaLengthToColumns(maxWidth[1]!);
    return columns !== null && context.viewportWidth <= columns;
  }

  return false;
}

function matchesMediaCondition(condition: string, context: MediaContext): boolean {
  const andParts = condition
    .split(/\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (andParts.length === 0) return true;

  return andParts.every((part) => matchesMediaFeature(part, context));
}

/** Return true when a comma-separated @media query list matches the viewport. */
export function matchesMediaQueryList(queryList: string, context: MediaContext): boolean {
  const orParts = queryList
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (orParts.length === 0) return true;

  return orParts.some((part) => matchesMediaCondition(part, context));
}
