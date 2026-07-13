import type { ComputedStyle } from "../style/style";

export interface BlockBox {
  /** Left edge of the padding box (after margin). */
  layoutX: number;
  /** Width of the padding box. */
  layoutWidth: number;
  /** Left edge of the content area (after padding). */
  contentX: number;
  /** Width available for wrapping content. */
  contentWidth: number;
}

/** Compute layout/content insets for a block from horizontal margin and padding. */
export function blockBox(
  style: ComputedStyle,
  originX: number,
  availableWidth: number,
): BlockBox {
  const marginLeft = style.marginLeft ?? 0;
  const marginRight = style.marginRight ?? 0;
  const paddingLeft = style.paddingLeft ?? 0;
  const paddingRight = style.paddingRight ?? 0;

  const layoutX = originX + marginLeft;
  const layoutWidth = Math.max(1, availableWidth - marginLeft - marginRight);
  const contentX = layoutX + paddingLeft;
  const contentWidth = Math.max(1, layoutWidth - paddingLeft - paddingRight);

  return { layoutX, layoutWidth, contentX, contentWidth };
}
