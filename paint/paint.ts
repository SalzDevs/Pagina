import { NodeType } from "../dom/node";
import type { Link, LinkBounds } from "../links/types";
import type { LayoutOutput } from "../layout/output";
import type { StyledNode } from "../style/style";
import type { DisplayList, FillCommand, TextCommand } from "./display-list";
import { commandBottom } from "./display-list";

export interface PaintOptions {
  viewportHeight?: number;
}

export interface PaintResult {
  displayList: DisplayList;
  links: Link[];
  contentHeight: number;
}

interface LinkCollector {
  href: string;
  bounds: LinkBounds[];
}

interface PaintContext {
  linkIndex: number | null;
  nextLinkIndex: { value: number };
  links: Link[];
  linkCollector?: LinkCollector;
}

interface PaintOutput {
  fills: FillCommand[];
  texts: TextCommand[];
  links: Link[];
  maxBottom: number;
}

function isBlock(node: StyledNode): boolean {
  return node.style.display === "block";
}

function trackBottom(output: PaintOutput, y: number, height: number): void {
  output.maxBottom = Math.max(output.maxBottom, y + height);
}

function trackLinkBounds(
  ctx: PaintContext,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.linkCollector?.bounds.push({ x, y, width, height });
}

function paintBlockBackground(
  node: StyledNode,
  layout: LayoutOutput,
  output: PaintOutput,
  viewportHeight?: number,
): void {
  const box = layout.getLayout(node);
  if (!isBlock(node) || !node.style.bg || !box) return;

  const tag = node.dom.type === NodeType.Element ? node.dom.tag : undefined;
  let height = box.height;

  if ((tag === "body" || tag === "html") && viewportHeight !== undefined) {
    height = Math.max(height, viewportHeight);
  }

  if (height <= 0 || box.width <= 0) return;

  const fill: FillCommand = {
    kind: "fill",
    x: box.x,
    y: box.y,
    width: box.width,
    height,
    bg: node.style.bg,
  };

  output.fills.push(fill);
  trackBottom(output, fill.y, fill.height);
}

function paintTextNode(
  node: StyledNode,
  layout: LayoutOutput,
  output: PaintOutput,
  ctx: PaintContext,
): void {
  const style = {
    fg: node.style.fg,
    bg: node.style.bg,
    bold: node.style.bold || undefined,
    italic: node.style.italic || undefined,
    underline: node.style.underline || undefined,
    linkIndex: ctx.linkCollector ? undefined : (ctx.linkIndex ?? undefined),
  };

  const fragments = layout.getFragments(node);
  if (fragments.length > 0) {
    for (const fragment of fragments) {
      if (fragment.text.length === 0) continue;

      trackLinkBounds(ctx, fragment.x, fragment.y, fragment.width, fragment.height);
      trackBottom(output, fragment.y, fragment.height);
      output.texts.push({
        kind: "text",
        x: fragment.x,
        y: fragment.y,
        text: fragment.text,
        ...style,
      });
    }
    return;
  }

  const box = layout.getLayout(node);
  if (!box || !node.dom.value) return;

  trackLinkBounds(ctx, box.x, box.y, box.width, 1);
  trackBottom(output, box.y, 1);
  output.texts.push({
    kind: "text",
    x: box.x,
    y: box.y,
    text: node.dom.value,
    ...style,
  });
}

function paintNode(
  node: StyledNode,
  layout: LayoutOutput,
  output: PaintOutput,
  ctx: PaintContext,
  viewportHeight?: number,
): void {
  switch (node.dom.type) {
    case NodeType.Text:
      paintTextNode(node, layout, output, ctx);
      return;

    case NodeType.Document:
    case NodeType.Element: {
      paintBlockBackground(node, layout, output, viewportHeight);

      if (layout.getFragments(node).length > 0) {
        paintTextNode(node, layout, output, ctx);
        return;
      }

      if (node.dom.type === NodeType.Element && node.dom.tag === "a" && node.dom.attributes?.href) {
        const href = node.dom.attributes.href;
        const collector: LinkCollector = { href, bounds: [] };
        const startTextCount = output.texts.length;
        const linkCtx: PaintContext = {
          ...ctx,
          linkIndex: null,
          linkCollector: collector,
        };

        for (const child of node.children) {
          paintNode(child, layout, output, linkCtx, viewportHeight);
        }

        if (collector.bounds.length > 0) {
          const linkIndex = ctx.nextLinkIndex.value;
          ctx.nextLinkIndex.value += 1;
          ctx.links.push({ href, bounds: collector.bounds });

          for (let index = startTextCount; index < output.texts.length; index++) {
            const command = output.texts[index];
            if (command) {
              command.linkIndex = linkIndex;
            }
          }
        }

        return;
      }

      for (const child of node.children) {
        paintNode(child, layout, output, ctx, viewportHeight);
      }
      return;
    }

    case NodeType.Comment:
    case NodeType.Doctype:
      return;
  }
}

/** Convert a laid-out styled tree into a display list. Does not draw anything. */
export function paint(
  node: StyledNode,
  layout: LayoutOutput,
  options: PaintOptions = {},
): PaintResult {
  const output: PaintOutput = { fills: [], texts: [], links: [], maxBottom: 0 };
  paintNode(
    node,
    layout,
    output,
    { linkIndex: null, nextLinkIndex: { value: 0 }, links: output.links },
    options.viewportHeight,
  );

  const displayList: DisplayList = [...output.fills, ...output.texts];
  const measuredHeight =
    displayList.length === 0 ? 0 : Math.max(...displayList.map((command) => commandBottom(command)));

  return {
    displayList,
    links: output.links,
    contentHeight: Math.max(output.maxBottom, measuredHeight),
  };
}
