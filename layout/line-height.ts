/** Map a computed font-size multiplier to terminal row height. */
export function lineHeightForFontSize(fontSize?: number): number {
  const size = fontSizeScale(fontSize);
  if (size <= 1) return 1;
  return Math.ceil((size - 1) * 2 + 1);
}

/** Normalized font-size multiplier used for layout. */
export function fontSizeScale(fontSize?: number): number {
  return fontSize ?? 1;
}

/** Layout units consumed by text at a given font size. */
export function textWrapUnits(text: string, fontSize?: number): number {
  return text.length * fontSizeScale(fontSize);
}

/** Maximum characters that fit on one line at a given font size. */
export function wrapCharacterBudget(contentWidth: number, fontSize?: number): number {
  return Math.max(1, Math.floor(contentWidth / fontSizeScale(fontSize)));
}

/** Default font-size multipliers for heading tags. */
export const HEADING_FONT_SIZES: Record<string, number> = {
  h1: 2.5,
  h2: 1.75,
  h3: 1.3,
  h4: 1.05,
  h5: 0.875,
  h6: 0.75,
};
