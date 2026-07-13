/** Map a computed font-size multiplier to terminal row height. */
export function lineHeightForFontSize(fontSize?: number): number {
  const size = fontSize ?? 1;
  if (size <= 1) return 1;
  return Math.ceil((size - 1) * 2 + 1);
}

/** Default font-size multipliers for heading tags. */
export const HEADING_FONT_SIZES: Record<string, number> = {
  h1: 2,
  h2: 1.5,
  h3: 1.17,
  h4: 1,
  h5: 0.83,
  h6: 0.67,
};
