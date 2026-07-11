import { NodeType } from "../dom/node";
import type { StyledNode } from "../style/style";
import type { DisplayCommand, DisplayList } from "./display-list";

interface PaintContext {
  linkIndex: number | null;
  nextLinkIndex: { value: number };
}

function paintTextNode(
  node: StyledNode,
  commands: DisplayCommand[],
  ctx: PaintContext,
): void {
  const style = {
    fg: node.style.fg,
    bg: node.style.bg,
    bold: node.style.bold || undefined,
    italic: node.style.italic || undefined,
    underline: node.style.underline || undefined,
    linkIndex: ctx.linkIndex ?? undefined,
  };

  if (node.fragments && node.fragments.length > 0) {
    for (const fragment of node.fragments) {
      if (fragment.text.length === 0) continue;

      commands.push({
        x: fragment.x,
        y: fragment.y,
        text: fragment.text,
        ...style,
      });
    }
    return;
  }

  if (!node.layout || !node.dom.value) return;

  commands.push({
    x: node.layout.x,
    y: node.layout.y,
    text: node.dom.value,
    ...style,
  });
}

function paintNode(node: StyledNode, commands: DisplayCommand[], ctx: PaintContext): void {
  switch (node.dom.type) {
    case NodeType.Text:
      paintTextNode(node, commands, ctx);
      return;

    case NodeType.Document:
    case NodeType.Element: {
      if (node.dom.type === NodeType.Element && node.dom.tag === "a" && node.dom.attributes?.href) {
        const linkIndex = ctx.nextLinkIndex.value;
        ctx.nextLinkIndex.value += 1;

        const linkCtx: PaintContext = {
          linkIndex,
          nextLinkIndex: ctx.nextLinkIndex,
        };

        for (const child of node.children) {
          paintNode(child, commands, linkCtx);
        }
        return;
      }

      for (const child of node.children) {
        paintNode(child, commands, ctx);
      }
      return;
    }

    case NodeType.Comment:
    case NodeType.Doctype:
      return;
  }
}

/** Convert a laid-out styled tree into a display list. Does not draw anything. */
export function paint(node: StyledNode): DisplayList {
  const commands: DisplayCommand[] = [];
  paintNode(node, commands, { linkIndex: null, nextLinkIndex: { value: 0 } });
  return commands;
}
