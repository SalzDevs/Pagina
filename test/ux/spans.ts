import type { RgbColor } from "../../links/focus-style";
import { contrastRatio, MIN_READABLE_CONTRAST_RATIO } from "../../links/focus-style";

type RgbaTuple = [number, number, number, number];

export const MIN_FOCUS_CONTRAST_RATIO = MIN_READABLE_CONTRAST_RATIO;

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

function rgbaToRgb(color: RgbaTuple): RgbColor {
  return { r: color[0]!, g: color[1]!, b: color[2]! };
}

/** Contrast ratio for a rendered span's foreground and background colors. */
export function spanContrastRatio(style: CapturedSpanStyle): number | null {
  if (!style.fg || !style.bg) return null;
  return contrastRatio(rgbaToRgb(style.fg), rgbaToRgb(style.bg));
}

/** True when a focused link span meets the minimum readability contrast. */
export function meetsFocusContrast(
  style: CapturedSpanStyle,
  minimumRatio = MIN_FOCUS_CONTRAST_RATIO,
): boolean {
  const ratio = spanContrastRatio(style);
  return ratio !== null && ratio >= minimumRatio;
}

/** True when focus styling collapsed to identical foreground and background. */
export function focusColorsCollapsed(style: CapturedSpanStyle): boolean {
  if (!style.fg || !style.bg) return false;
  return (
    style.fg[0] === style.bg[0] &&
    style.fg[1] === style.bg[1] &&
    style.fg[2] === style.bg[2]
  );
}
