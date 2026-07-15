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
  let marginLeft = style.marginLeft ?? 0;
  let marginRight = style.marginRight ?? 0;
  const paddingLeft = style.paddingLeft ?? 0;
  const paddingRight = style.paddingRight ?? 0;
  const declaredWidth = style.width;

  let layoutWidth = Math.max(1, availableWidth - marginLeft - marginRight);
  if (declaredWidth !== undefined) {
    layoutWidth = Math.min(layoutWidth, declaredWidth);
  }

  if (style.marginLeftAuto && style.marginRightAuto && declaredWidth !== undefined) {
    const spare = Math.max(0, availableWidth - layoutWidth);
    marginLeft = Math.floor(spare / 2);
    marginRight = spare - marginLeft;
  }

  const layoutX = originX + marginLeft;
  const contentX = layoutX + paddingLeft;
  const contentWidth = Math.max(1, layoutWidth - paddingLeft - paddingRight);

  return { layoutX, layoutWidth, contentX, contentWidth };
}
