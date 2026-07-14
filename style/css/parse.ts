import { DEFAULT_MEDIA_CONTEXT, matchesMediaQueryList, type MediaContext } from "./media";
import type { CssDeclarations, CssRule, CssSelector, SimpleSelector } from "./types";

export type { MediaContext } from "./media";

const FONT_SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 0.6,
  "x-small": 0.75,
  small: 0.875,
  medium: 1,
  large: 1.125,
  "x-large": 1.25,
  "xx-large": 1.5,
};

function parseLength(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|em|rem|%|ch)?$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return undefined;

  return Math.max(0, Math.round(amount));
}

type SpacingSide = "Top" | "Right" | "Bottom" | "Left";

type SpacingDeclarationKey =
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft";

function applySpacingShorthand(
  declarations: CssDeclarations,
  prefix: "margin" | "padding",
  value: string,
): void {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return;

  const read = (index: number) => parseLength(parts[index]!);

  const sides: Record<SpacingSide, number | undefined> = {
    Top: undefined,
    Right: undefined,
    Bottom: undefined,
    Left: undefined,
  };

  if (parts.length === 1) {
    sides.Top = read(0);
    sides.Right = read(0);
    sides.Bottom = read(0);
    sides.Left = read(0);
  } else if (parts.length === 2) {
    sides.Top = read(0);
    sides.Bottom = read(0);
    sides.Right = read(1);
    sides.Left = read(1);
  } else if (parts.length === 3) {
    sides.Top = read(0);
    sides.Right = read(1);
    sides.Left = read(1);
    sides.Bottom = read(2);
  } else {
    sides.Top = read(0);
    sides.Right = read(1);
    sides.Bottom = read(2);
    sides.Left = read(3);
  }

  for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
    const spacing = sides[side];
    if (spacing === undefined) continue;

    const key = `${prefix}${side}` as SpacingDeclarationKey;
    declarations[key] = spacing;
  }
}

function parseFontSize(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (trimmed in FONT_SIZE_KEYWORDS) {
    return FONT_SIZE_KEYWORDS[trimmed];
  }

  const match = trimmed.match(/^([\d.]+)(px|em|rem|%)$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return undefined;

  switch (match[2]) {
    case "px":
      return amount / 16;
    case "em":
    case "rem":
      return amount;
    case "%":
      return amount / 100;
    default:
      return undefined;
  }
}

function parseDeclarations(block: string): CssDeclarations {
  const declarations: CssDeclarations = {};

  for (const chunk of block.split(";")) {
    const separator = chunk.indexOf(":");
    if (separator === -1) continue;

    const property = chunk.slice(0, separator).trim().toLowerCase();
    const value = chunk.slice(separator + 1).trim();
    if (value.length === 0) continue;

    switch (property) {
      case "color":
        declarations.color = value;
        break;
      case "background":
        declarations.background = value;
        break;
      case "background-color":
        declarations.backgroundColor = value;
        break;
      case "font-weight":
        declarations.fontWeight = value;
        break;
      case "font-style":
        declarations.fontStyle = value;
        break;
      case "font-size":
        declarations.fontSize = parseFontSize(value);
        break;
      case "text-decoration":
        declarations.textDecoration = value;
        break;
      case "display":
        declarations.display = value;
        break;
      case "white-space":
        declarations.whiteSpace = value;
        break;
      case "margin-top":
        declarations.marginTop = parseLength(value);
        break;
      case "margin-bottom":
        declarations.marginBottom = parseLength(value);
        break;
      case "margin-left":
        declarations.marginLeft = parseLength(value);
        break;
      case "margin-right":
        declarations.marginRight = parseLength(value);
        break;
      case "padding-top":
        declarations.paddingTop = parseLength(value);
        break;
      case "padding-bottom":
        declarations.paddingBottom = parseLength(value);
        break;
      case "padding-left":
        declarations.paddingLeft = parseLength(value);
        break;
      case "padding-right":
        declarations.paddingRight = parseLength(value);
        break;
      case "margin":
        applySpacingShorthand(declarations, "margin", value);
        break;
      case "padding":
        applySpacingShorthand(declarations, "padding", value);
        break;
    }
  }

  return declarations;
}

function parseSimpleSelector(raw: string): SimpleSelector | null {
  const selector = raw.trim();
  if (selector.length === 0) return null;

  const tagClass = selector.match(/^([a-zA-Z][\w-]*)\.([a-zA-Z][\w-]*)$/);
  if (tagClass) {
    return { kind: "tag-class", tag: tagClass[1]!.toLowerCase(), className: tagClass[2]! };
  }

  const tagId = selector.match(/^([a-zA-Z][\w-]*)#([a-zA-Z][\w-]*)$/);
  if (tagId) {
    return { kind: "tag-id", tag: tagId[1]!.toLowerCase(), id: tagId[2]! };
  }

  if (selector.startsWith(".")) {
    const className = selector.slice(1);
    return className.length > 0 ? { kind: "class", className } : null;
  }

  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    return id.length > 0 ? { kind: "id", id } : null;
  }

  if (/^[a-zA-Z][\w-]*$/.test(selector)) {
    return { kind: "tag", tag: selector.toLowerCase() };
  }

  return null;
}

function parseSelector(raw: string): CssSelector | null {
  const selector = raw.trim();
  if (selector.length === 0) return null;

  const parts = selector.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parseSimpleSelector(parts[0]!);
  }

  const chain = parts
    .map(parseSimpleSelector)
    .filter((part): part is SimpleSelector => part !== null);

  if (chain.length !== parts.length) return null;

  return { kind: "descendant", chain };
}

function skipBlock(css: string, openBraceIndex: number): number {
  let index = openBraceIndex + 1;
  let depth = 1;

  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth++;
    else if (css[index] === "}") depth--;
    if (depth > 0) index++;
  }

  return index;
}

function readAtRuleName(css: string, start: number): { name: string; end: number } {
  let end = start + 1;
  while (end < css.length && /[-a-zA-Z0-9]/.test(css[end]!)) {
    end++;
  }

  return {
    name: css.slice(start + 1, end).toLowerCase(),
    end,
  };
}

/** Remove or unwrap at-rules so the remaining CSS parses as plain rule blocks. */
export function preprocessStylesheet(
  css: string,
  context: MediaContext = DEFAULT_MEDIA_CONTEXT,
): string {
  let result = "";
  let index = 0;

  while (index < css.length) {
    if (css[index] === "@") {
      const { name, end } = readAtRuleName(css, index);
      let braceIndex = end;
      while (braceIndex < css.length && css[braceIndex] !== "{") {
        braceIndex++;
      }

      if (braceIndex >= css.length) break;

      const blockEnd = skipBlock(css, braceIndex);
      const condition = css.slice(end, braceIndex).trim();
      const inner = css.slice(braceIndex + 1, blockEnd);

      if (name === "media" && matchesMediaQueryList(condition, context)) {
        result += preprocessStylesheet(inner, context);
      }

      index = blockEnd + 1;
      continue;
    }

    result += css[index];
    index++;
  }

  return result;
}

function extractRuleBlocks(css: string): Array<{ selectorText: string; body: string }> {
  const blocks: Array<{ selectorText: string; body: string }> = [];
  let index = 0;

  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index]!)) {
      index++;
    }

    if (index >= css.length) break;

    if (css[index] === "@") {
      const { end } = readAtRuleName(css, index);
      let braceIndex = end;
      while (braceIndex < css.length && css[braceIndex] !== "{") {
        braceIndex++;
      }
      if (braceIndex >= css.length) break;
      index = skipBlock(css, braceIndex) + 1;
      continue;
    }

    const selectorStart = index;
    while (index < css.length && css[index] !== "{") {
      index++;
    }

    if (index >= css.length) break;

    const selectorText = css.slice(selectorStart, index).trim();
    const bodyStart = index + 1;
    const bodyEnd = skipBlock(css, index);
    const body = css.slice(bodyStart, bodyEnd);
    index = bodyEnd + 1;

    if (selectorText.length === 0) continue;

    blocks.push({ selectorText, body });
  }

  return blocks;
}

/** Parse a minimal stylesheet into rules. */
export function parseStylesheet(
  css: string,
  context: MediaContext = DEFAULT_MEDIA_CONTEXT,
): CssRule[] {
  const rules: CssRule[] = [];
  const normalized = preprocessStylesheet(css, context);

  for (const block of extractRuleBlocks(normalized)) {
    const selectors = block.selectorText
      .split(",")
      .map(parseSelector)
      .filter((selector): selector is CssSelector => selector !== null);

    if (selectors.length === 0) continue;

    rules.push({
      selectors,
      declarations: parseDeclarations(block.body),
    });
  }

  return rules;
}

/** Parse an inline `style=""` attribute value. */
export function parseInlineStyle(value: string): CssDeclarations {
  return parseDeclarations(value);
}
