/** CSS color values safe to pass to the terminal renderer. */
const KEYWORD_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

const IGNORED_COLOR_KEYWORDS = new Set([
  "transparent",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "currentcolor",
  "none",
  "auto",
]);

const UNSUPPORTED_COLOR_PATTERN =
  /url\(|var\(|calc\(|gradient|@|\/\*|;\s|important|repeat|scroll|fixed|local|padding-box|border-box|content-box/i;

function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

function isRgbColor(value: string): boolean {
  return /^rgba?\([^)]+\)$/i.test(value);
}

function isNamedColor(value: string): boolean {
  return KEYWORD_COLORS.has(value.toLowerCase());
}

/** Return true when a CSS value looks like a supported terminal color. */
export function isSupportedColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (IGNORED_COLOR_KEYWORDS.has(trimmed.toLowerCase())) return false;
  if (UNSUPPORTED_COLOR_PATTERN.test(trimmed)) return false;

  return isHexColor(trimmed) || isRgbColor(trimmed) || isNamedColor(trimmed);
}

function extractColorToken(value: string): string | undefined {
  if (isSupportedColorValue(value)) return value.trim();

  for (const token of value.split(/\s+/)) {
    const cleaned = token.replace(/,$/, "");
    if (isSupportedColorValue(cleaned)) return cleaned;
  }

  return undefined;
}

/** Normalize a CSS color value, ignoring unsupported author styles. */
export function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return extractColorToken(value.trim());
}

/** Extract a background color from a CSS background or background-color value. */
export function normalizeBackgroundColor(
  backgroundColor: string | undefined,
  background: string | undefined,
): string | undefined {
  return normalizeColor(backgroundColor) ?? normalizeColor(background);
}
