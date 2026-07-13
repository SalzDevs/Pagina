import { NodeType } from "../dom/node";
import type { LayoutFragment, StyledNode } from "../style/style";
import { blockBox } from "./box";
import type { LayoutContext } from "./layout";

export const HR_CHARACTER = "─";

export function isHrElement(node: StyledNode): boolean {
  return node.dom.type === NodeType.Element && node.dom.tag === "hr";
}

export function formatHrLine(contentWidth: number): string {
  return HR_CHARACTER.repeat(Math.max(1, contentWidth));
}

export interface HrLayoutDeps {
  addFragment: (node: StyledNode, fragment: LayoutFragment) => void;
  blockGap: number;
}

/** Lay out a horizontal rule as a row of line characters. */
export function layoutHr(node: StyledNode, ctx: LayoutContext, deps: HrLayoutDeps): void {
  const box = blockBox(node.style, ctx.x, ctx.availableWidth);

  ctx.y += node.style.marginTop ?? 0;
  const startY = ctx.y;
  ctx.y += node.style.paddingTop ?? 0;

  const line = formatHrLine(box.contentWidth);
  deps.addFragment(node, {
    x: box.contentX,
    y: ctx.y,
    width: box.contentWidth,
    height: 1,
    text: line,
  });
  ctx.y += 1;

  ctx.y += node.style.paddingBottom ?? 0;

  node.layout = {
    x: box.layoutX,
    y: startY,
    width: box.layoutWidth,
    height: Math.max(1, ctx.y - startY),
  };

  ctx.y += node.style.marginBottom ?? 0;
  ctx.y += deps.blockGap;
}
