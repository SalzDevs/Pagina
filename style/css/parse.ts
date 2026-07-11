import type { CssDeclarations, CssRule, CssSelector } from "./types";

function parseLength(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return undefined;

  return Math.max(0, Math.round(amount));
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
      case "text-decoration":
        declarations.textDecoration = value;
        break;
      case "display":
        declarations.display = value;
        break;
      case "margin-top":
        declarations.marginTop = parseLength(value);
        break;
      case "margin-bottom":
        declarations.marginBottom = parseLength(value);
        break;
      case "padding-top":
        declarations.paddingTop = parseLength(value);
        break;
      case "padding-bottom":
        declarations.paddingBottom = parseLength(value);
        break;
      case "margin": {
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          declarations.marginTop = parseLength(parts[0]!);
          declarations.marginBottom = parseLength(parts[0]!);
        } else if (parts.length >= 2) {
          declarations.marginTop = parseLength(parts[0]!);
          declarations.marginBottom = parseLength(parts[1]!);
        }
        break;
      }
      case "padding": {
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          declarations.paddingTop = parseLength(parts[0]!);
          declarations.paddingBottom = parseLength(parts[0]!);
        } else if (parts.length >= 2) {
          declarations.paddingTop = parseLength(parts[0]!);
          declarations.paddingBottom = parseLength(parts[1]!);
        }
        break;
      }
    }
  }

  return declarations;
}

function parseSelector(raw: string): CssSelector | null {
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

/** Parse a minimal stylesheet into rules. */
export function parseStylesheet(css: string): CssRule[] {
  const rules: CssRule[] = [];

  for (const block of css.split("}")) {
    const brace = block.indexOf("{");
    if (brace === -1) continue;

    const selectorText = block.slice(0, brace).trim();
    const body = block.slice(brace + 1);
    if (selectorText.length === 0) continue;

    const selectors = selectorText
      .split(",")
      .map(parseSelector)
      .filter((selector): selector is CssSelector => selector !== null);

    if (selectors.length === 0) continue;

    rules.push({
      selectors,
      declarations: parseDeclarations(body),
    });
  }

  return rules;
}

/** Parse an inline `style=""` attribute value. */
export function parseInlineStyle(value: string): CssDeclarations {
  return parseDeclarations(value);
}
