export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** WCAG AA contrast threshold for normal-sized terminal link text. */
export const MIN_READABLE_CONTRAST_RATIO = 4.5;

const NAMED_COLORS: Record<string, RgbColor> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  yellow: { r: 255, g: 255, b: 0 },
  cyan: { r: 0, g: 255, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
  silver: { r: 192, g: 192, b: 192 },
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(value: string): RgbColor | null {
  const match = value.match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;

  const hex = match[1]!.toLowerCase();
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0]! + hex[0]!, 16),
      g: Number.parseInt(hex[1]! + hex[1]!, 16),
      b: Number.parseInt(hex[2]! + hex[2]!, 16),
    };
  }

  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function parseRgbColor(value: string): RgbColor | null {
  const match = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!match) return null;

  return {
    r: clampChannel(Number(match[1])),
    g: clampChannel(Number(match[2])),
    b: clampChannel(Number(match[3])),
  };
}

/** Blend a foreground color over a backdrop using CSS opacity compositing. */
export function blendColors(foreground: string, background: string, opacity: number): string {
  if (opacity >= 1) return foreground;
  if (opacity <= 0) return background;

  const fg = parseTerminalColor(foreground);
  const bg = parseTerminalColor(background);
  if (!fg || !bg) return foreground;

  const toHex = (channel: number) => clampChannel(channel).toString(16).padStart(2, "0");
  return `#${toHex(fg.r * opacity + bg.r * (1 - opacity))}${toHex(fg.g * opacity + bg.g * (1 - opacity))}${toHex(fg.b * opacity + bg.b * (1 - opacity))}`;
}

/** Parse a terminal color string into RGB channels. */
export function parseTerminalColor(value: string): RgbColor | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  return (
    parseHexColor(trimmed) ??
    parseRgbColor(trimmed) ??
    NAMED_COLORS[trimmed.toLowerCase()] ??
    null
  );
}

function relativeLuminance(color: RgbColor): number {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG 2.x contrast ratio between two sRGB colors. */
export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a focused/unfocused color pair meets a readability threshold. */
export function meetsContrastThreshold(
  foreground: string,
  background: string,
  minimumRatio = MIN_READABLE_CONTRAST_RATIO,
): boolean {
  const foregroundColor = parseTerminalColor(foreground);
  const backgroundColor = parseTerminalColor(background);
  if (!foregroundColor || !backgroundColor) return false;
  return contrastRatio(foregroundColor, backgroundColor) >= minimumRatio;
}

/** Pick readable text on top of a solid background color. */
export function contrastingForeground(background: RgbColor): string {
  const black: RgbColor = { r: 0, g: 0, b: 0 };
  const white: RgbColor = { r: 255, g: 255, b: 255 };
  return contrastRatio(black, background) >= contrastRatio(white, background)
    ? "#000000"
    : "#ffffff";
}

/** Derive focused link colors from the underlying cell palette. */
export function focusedLinkColors(
  restFg?: string,
  restBg?: string,
): { fg: string; bg: string } {
  if (restFg && restBg) {
    const foreground = parseTerminalColor(restFg);
    const background = parseTerminalColor(restBg);
    if (foreground && background) {
      if (contrastRatio(foreground, background) >= MIN_READABLE_CONTRAST_RATIO) {
        return { fg: restBg, bg: restFg };
      }
      return { fg: contrastingForeground(foreground), bg: restFg };
    }

    return { fg: restBg, bg: restFg };
  }

  if (restFg) {
    const parsed = parseTerminalColor(restFg);
    return {
      fg: parsed ? contrastingForeground(parsed) : "#000000",
      bg: restFg,
    };
  }

  if (restBg) {
    const parsed = parseTerminalColor(restBg);
    return {
      fg: parsed ? contrastingForeground(parsed) : "#ffffff",
      bg: restBg,
    };
  }

  return { fg: "#000000", bg: "#cccccc" };
}
