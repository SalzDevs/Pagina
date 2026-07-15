type RgbaTuple = [number, number, number, number];

export interface CapturedSpanStyle {
  text: string;
  fg: RgbaTuple | null;
  bg: RgbaTuple | null;
  attributes: number;
}

export interface CapturedSpans {
  lines: Array<{
    spans: Array<{
      text: string;
      fg?: { buffer: Record<number, number> };
      bg?: { buffer: Record<number, number> };
      attributes: number;
    }>;
  }>;
}

function colorTuple(color: unknown): RgbaTuple | null {
  if (!color || typeof color !== "object" || !("buffer" in color)) return null;

  const buffer = (color as { buffer: Record<number, number> }).buffer;
  return [buffer[0] ?? 0, buffer[1] ?? 0, buffer[2] ?? 0, buffer[3] ?? 0];
}

/** Collect rendered span styles whose text includes a needle. */
export function findSpanStyles(capture: CapturedSpans, needle: string): CapturedSpanStyle[] {
  const matches: CapturedSpanStyle[] = [];

  for (const line of capture.lines) {
    for (const span of line.spans) {
      if (!span.text.includes(needle)) continue;

      matches.push({
        text: span.text.trim(),
        fg: colorTuple(span.fg),
        bg: colorTuple(span.bg),
        attributes: span.attributes,
      });
    }
  }

  return matches;
}

/** True when a span uses the focused-link background treatment. */
export function hasFocusedLinkBackground(style: CapturedSpanStyle): boolean {
  if (!style.bg) return false;
  const [, , , alpha] = style.bg;
  return alpha === 255 && (style.bg[0]! + style.bg[1]! + style.bg[2]!) > 0;
}

/** True when two captured span styles differ in color or attributes. */
export function spanStylesDiffer(left: CapturedSpanStyle, right: CapturedSpanStyle): boolean {
  return (
    left.attributes !== right.attributes ||
    JSON.stringify(left.fg) !== JSON.stringify(right.fg) ||
    JSON.stringify(left.bg) !== JSON.stringify(right.bg)
  );
}
