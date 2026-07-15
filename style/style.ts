import { HEADING_FONT_SIZES } from "../layout/line-height";
import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { applyAuthorStyles } from "./css/apply";
import { collectStylesheetRules } from "./css/collect";
import { DEFAULT_MEDIA_CONTEXT } from "./css/media";
import { buildRuleIndex, type CssRuleIndex } from "./css/index";
import type { CssRule } from "./css/types";

export type Display = "block" | "inline" | "none";

export type WhiteSpace = "normal" | "pre" | "pre-wrap" | "nowrap";

export interface ComputedStyle {
  display: Display;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fg?: string;
  bg?: string;
  fontSize?: number;
  whiteSpace?: WhiteSpace;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginLeftAuto?: boolean;
  marginRightAuto?: boolean;
  width?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  customProperties?: Record<string, string>;
}

export interface StyledNode {
  dom: Node;
  style: ComputedStyle;
  children: StyledNode[];
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

/** Default left inset for blockquote elements (terminal columns). */
export const BLOCKQUOTE_INDENT = 4;

/** Vertical margin above and below horizontal rules. */
export const HR_VERTICAL_MARGIN = 1;

/** Default foreground for image placeholders. */
export const IMG_PLACEHOLDER_FG = "#888888";

/** User-agent colors for inline `<code>` elements. */
export const INLINE_CODE_FG = "#ce9178";
export const INLINE_CODE_BG = "#2a2a2a";

/** Default body text color (matches browser UA `body { color: #000 }`). */
export const UA_BODY_FG = "#000000";

const INLINE_BG_PARENT_TAGS = new Set(["code", "kbd", "samp"]);

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
    fontSize: inherited.fontSize,
    whiteSpace: inherited.whiteSpace,
    customProperties: inherited.customProperties
      ? { ...inherited.customProperties }
      : undefined,
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
    case "body":
    case "html":
      return { ...style, display: "block", fg: UA_BODY_FG };
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
      return { ...style, fg: INLINE_CODE_FG, bg: INLINE_CODE_BG };
    case "pre":
      return { ...style, whiteSpace: "pre" };
    case "th":
      return { ...style, bold: true };
    case "dt":
      return { ...style, bold: true };
    case "blockquote":
      return {
        ...style,
        marginLeft: BLOCKQUOTE_INDENT,
      };
    case "hr":
      return {
        ...style,
        marginTop: HR_VERTICAL_MARGIN,
        marginBottom: HR_VERTICAL_MARGIN,
        fg: "#666666",
      };
    case "img":
      return {
        ...style,
        italic: true,
        fg: IMG_PLACEHOLDER_FG,
      };
    default:
      return style;
  }
}

function styleNode(
  node: Node,
  inherited: ComputedStyle,
  rules: CssRule[],
  ruleIndex: CssRuleIndex,
  ancestors: Node[],
): StyledNode | null {
  switch (node.type) {
    case NodeType.Document: {
      const children = node.children
        ?.map((child) => styleNode(child, inherited, rules, ruleIndex, ancestors))
        .filter((child): child is StyledNode => child !== null) ?? [];

      return {
        dom: node,
        style: { ...DEFAULT_STYLE, display: "block" },
        children,
      };
    }

    case NodeType.Element: {
      const uaStyle = uaStyleForElement(node.tag ?? "", inherited);
      const style = applyAuthorStyles(node, uaStyle, rules, ruleIndex, ancestors);
      if (style.display === "none") return null;

      ancestors.push(node);
      const children =
        node.children
          ?.map((child) => styleNode(child, style, rules, ruleIndex, ancestors))
          .filter((child): child is StyledNode => child !== null) ?? [];
      ancestors.pop();

      return { dom: node, style, children };
    }

    case NodeType.Text: {
      if (!node.value || node.value.length === 0) return null;

      const parentTag =
        ancestors.at(-1)?.type === NodeType.Element ? ancestors.at(-1)?.tag : undefined;
      const preserveInlineBg =
        parentTag !== undefined && INLINE_BG_PARENT_TAGS.has(parentTag) && inherited.bg !== undefined;

      return {
        dom: node,
        style: {
          ...inherited,
          display: "inline",
          bg: preserveInlineBg ? inherited.bg : undefined,
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
  viewportWidth?: number;
  viewportHeight?: number;
  cssWarnings?: string[];
}

/** Apply user-agent defaults and author CSS to a DOM tree. */
export async function computeStyles(
  root: Node,
  options: ComputeStylesOptions = {},
): Promise<StyledNode> {
  const documentBase = options.documentBase ?? options.pageLocation;
  const viewportWidth = options.viewportWidth ?? DEFAULT_MEDIA_CONTEXT.viewportWidth;
  const viewportHeight = options.viewportHeight ?? DEFAULT_MEDIA_CONTEXT.viewportHeight;
  const { rules, warnings } = await collectStylesheetRules(root, options.pageLocation, documentBase, {
    viewportWidth,
    viewportHeight,
  });
  if (options.cssWarnings) {
    options.cssWarnings.push(...warnings);
  }
  const ruleIndex = buildRuleIndex(rules);
  const ancestors: Node[] = [];
  const styled = styleNode(root, DEFAULT_STYLE, rules, ruleIndex, ancestors);
  if (!styled) {
    throw new Error("Document produced no styled output");
  }
  return styled;
}
