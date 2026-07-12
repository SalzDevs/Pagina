import type { ComputedStyle, Display } from "../style";
import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import { matchesSelector } from "./match";
import { normalizeBackgroundColor, normalizeColor } from "./color";
import { parseInlineStyle } from "./parse";
import type { CssDeclarations, CssRule } from "./types";

function isBold(fontWeight?: string): boolean | undefined {
  if (!fontWeight) return undefined;
  const normalized = fontWeight.toLowerCase();
  return normalized === "bold" || normalized === "bolder" || Number(normalized) >= 700;
}

function isItalic(fontStyle?: string): boolean | undefined {
  if (!fontStyle) return undefined;
  return fontStyle.toLowerCase() === "italic";
}

function isUnderline(textDecoration?: string): boolean | undefined {
  if (!textDecoration) return undefined;
  return textDecoration.toLowerCase().includes("underline");
}

function parseDisplay(value?: string): Display | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "block" || normalized === "inline" || normalized === "none") {
    return normalized;
  }
  return undefined;
}

function mergeDeclarations(
  style: ComputedStyle,
  declarations: CssDeclarations,
): ComputedStyle {
  const next = { ...style };

  const set = <K extends keyof ComputedStyle>(
    key: K,
    value: ComputedStyle[K] | undefined,
  ) => {
    if (value !== undefined) {
      next[key] = value;
    }
  };

  set("fg", normalizeColor(declarations.color));
  set("bg", normalizeBackgroundColor(declarations.backgroundColor, declarations.background));
  set("bold", isBold(declarations.fontWeight));
  set("italic", isItalic(declarations.fontStyle));
  set("underline", isUnderline(declarations.textDecoration));
  set("display", parseDisplay(declarations.display));
  set("fontSize", declarations.fontSize);

  if (declarations.fontSize !== undefined && declarations.fontSize >= 1.2) {
    next.bold = true;
  }

  set("marginTop", declarations.marginTop);
  set("marginBottom", declarations.marginBottom);
  set("paddingTop", declarations.paddingTop);
  set("paddingBottom", declarations.paddingBottom);

  return next;
}

/** Apply stylesheet and inline author styles on top of a computed style. */
export function applyAuthorStyles(
  node: Node,
  base: ComputedStyle,
  rules: CssRule[],
  ancestors: readonly Node[] = [],
): ComputedStyle {
  if (node.type !== NodeType.Element) return base;

  let style = base;

  for (const rule of rules) {
    const matched = rule.selectors.some((selector) => matchesSelector(node, selector, ancestors));
    if (matched) {
      style = mergeDeclarations(style, rule.declarations);
    }
  }

  const inlineStyle = node.attributes?.style;
  if (inlineStyle) {
    style = mergeDeclarations(style, parseInlineStyle(inlineStyle));
  }

  return style;
}
