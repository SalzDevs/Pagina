import { HEADING_FONT_SIZES } from "../layout/line-height";
import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { applyAuthorStyles } from "./css/apply";
import { collectStylesheetRules } from "./css/collect";
import type { CssRule } from "./css/types";

export type Display = "block" | "inline" | "none";

export interface ComputedStyle {
  display: Display;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fg?: string;
  bg?: string;
  fontSize?: number;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

export interface LayoutFragment {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface StyledNode {
  dom: Node;
  style: ComputedStyle;
  children: StyledNode[];
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fragments?: LayoutFragment[];
}

const DEFAULT_STYLE: ComputedStyle = {
  display: "inline",
  bold: false,
  italic: false,
  underline: false,
};

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "div",
  "dl",
  "dt",
  "dd",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "html",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

const HIDDEN_TAGS = new Set([
  "head",
  "link",
  "meta",
  "noscript",
  "script",
  "style",
  "template",
  "title",
]);

function uaDisplay(tag: string): Display {
  if (HIDDEN_TAGS.has(tag)) return "none";
  if (BLOCK_TAGS.has(tag)) return "block";
  return "inline";
}

function uaStyleForElement(tag: string, inherited: ComputedStyle): ComputedStyle {
  const style: ComputedStyle = {
    display: uaDisplay(tag),
    bold: inherited.bold,
    italic: inherited.italic,
    underline: inherited.underline,
    fg: inherited.fg,
    bg: inherited.bg,
    marginTop: inherited.marginTop,
    marginBottom: inherited.marginBottom,
    paddingTop: inherited.paddingTop,
    paddingBottom: inherited.paddingBottom,
    fontSize: inherited.fontSize,
  };

  switch (tag) {
    case "strong":
    case "b":
      return { ...style, bold: true };
    case "em":
    case "i":
      return { ...style, italic: true };
    case "u":
      return { ...style, underline: true };
    case "a":
      return { ...style, underline: true, fg: "#569cd6" };
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return {
        ...style,
        display: "block",
        bold: true,
        fontSize: HEADING_FONT_SIZES[tag] ?? style.fontSize,
      };
    case "code":
      return { ...style, fg: "#ce9178" };
    default:
      return style;
  }
}

function styleNode(
  node: Node,
  inherited: ComputedStyle,
  rules: CssRule[],
  ancestors: Node[] = [],
): StyledNode | null {
  switch (node.type) {
    case NodeType.Document: {
      const children = node.children
        ?.map((child) => styleNode(child, inherited, rules, ancestors))
        .filter((child): child is StyledNode => child !== null) ?? [];

      return {
        dom: node,
        style: { ...DEFAULT_STYLE, display: "block" },
        children,
      };
    }

    case NodeType.Element: {
      const uaStyle = uaStyleForElement(node.tag ?? "", inherited);
      const style = applyAuthorStyles(node, uaStyle, rules, ancestors);
      if (style.display === "none") return null;

      const nextAncestors = [...ancestors, node];
      const children =
        node.children
          ?.map((child) => styleNode(child, style, rules, nextAncestors))
          .filter((child): child is StyledNode => child !== null) ?? [];

      return { dom: node, style, children };
    }

    case NodeType.Text: {
      if (!node.value || node.value.length === 0) return null;

      return {
        dom: node,
        style: {
          ...inherited,
          display: "inline",
          bg: undefined,
        },
        children: [],
      };
    }

    case NodeType.Comment:
    case NodeType.Doctype:
      return null;
  }
}

export interface ComputeStylesOptions {
  pageLocation?: string;
  documentBase?: string;
}

/** Apply user-agent defaults and author CSS to a DOM tree. */
export async function computeStyles(
  root: Node,
  options: ComputeStylesOptions = {},
): Promise<StyledNode> {
  const documentBase = options.documentBase ?? options.pageLocation;
  const rules = await collectStylesheetRules(root, options.pageLocation, documentBase);
  const styled = styleNode(root, DEFAULT_STYLE, rules);
  if (!styled) {
    throw new Error("Document produced no styled output");
  }
  return styled;
}
