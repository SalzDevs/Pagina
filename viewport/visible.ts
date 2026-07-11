import type { DisplayCommand, DisplayList } from "../paint/display-list";
import type { StyledNode } from "../style/style";

/** Measure document height from laid-out text fragments only. */
export function measureContentHeight(styled: StyledNode): number {
  let maxBottom = 0;

  const walk = (node: StyledNode): void => {
    for (const fragment of node.fragments ?? []) {
      maxBottom = Math.max(maxBottom, fragment.y + fragment.height);
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(styled);
  return maxBottom;
}

/** Measure document height from a display list. */
export function measureDisplayListHeight(displayList: DisplayList): number {
  if (displayList.length === 0) return 0;
  return Math.max(...displayList.map((command) => command.y)) + 1;
}

/** Keep only commands visible in the scrolled viewport. */
export function visibleCommands(
  displayList: DisplayList,
  scrollY: number,
  viewportHeight: number,
): DisplayCommand[] {
  const maxY = scrollY + viewportHeight;

  return displayList
    .filter((command) => command.y >= scrollY && command.y < maxY)
    .map((command) => ({
      ...command,
      y: command.y - scrollY,
    }));
}

/** True when the viewport shows at least one command at max scroll. */
export function hasVisibleContentAtMaxScroll(
  displayList: DisplayList,
  contentHeight: number,
  viewportHeight: number,
): boolean {
  const scrollY = Math.max(0, contentHeight - viewportHeight);
  return visibleCommands(displayList, scrollY, viewportHeight).length > 0;
}
