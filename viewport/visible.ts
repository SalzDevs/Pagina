import type { DisplayCommand, DisplayList } from "../paint/display-list";
import { commandBottom, commandRight } from "../paint/display-list";
import type { LayoutOutput } from "../layout/output";
import type { StyledNode } from "../style/style";

/** Mount only visible commands once the page exceeds this command count. */
export const CULL_COMMAND_THRESHOLD = 200;

/** Mount only visible commands once content is taller than this many viewports. */
export const CULL_HEIGHT_VIEWPORTS = 2;

/** Extra rows mounted above and below the viewport to reduce pop-in while scrolling. */
export const DEFAULT_VISIBLE_BUFFER_ROWS = 2;

export interface VisibleCommandEntry {
  commandIndex: number;
  command: DisplayCommand;
}

/** True when mounting the full display list is likely wasteful. */
export function shouldCullDisplayList(
  displayList: DisplayList,
  contentHeight: number,
  viewportHeight: number,
): boolean {
  return (
    displayList.length > CULL_COMMAND_THRESHOLD ||
    contentHeight > viewportHeight * CULL_HEIGHT_VIEWPORTS
  );
}

/** Choose the commands to mount for the current scroll position. */
export function displayListMountEntries(
  displayList: DisplayList,
  options: {
    scrollX: number;
    scrollY: number;
    viewportWidth: number;
    viewportHeight: number;
    contentWidth: number;
    contentHeight: number;
  },
): VisibleCommandEntry[] {
  const { scrollX, scrollY, viewportWidth, viewportHeight, contentHeight } = options;

  if (shouldCullDisplayList(displayList, contentHeight, viewportHeight)) {
    return visibleCommandEntries(displayList, scrollX, scrollY, viewportWidth, viewportHeight);
  }

  return displayList.map((command, commandIndex) => ({ commandIndex, command }));
}

/** Keep only commands visible in the scrolled viewport. */
export function visibleCommandEntries(
  displayList: DisplayList,
  scrollX: number,
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
  bufferRows = DEFAULT_VISIBLE_BUFFER_ROWS,
): VisibleCommandEntry[] {
  const minY = Math.max(0, scrollY - bufferRows);
  const maxY = scrollY + viewportHeight + bufferRows;
  const minX = Math.max(0, scrollX - 1);
  const maxX = scrollX + viewportWidth + 1;
  const entries: VisibleCommandEntry[] = [];

  for (const [commandIndex, command] of displayList.entries()) {
    const bottom = commandBottom(command);
    if (bottom <= minY || command.y >= maxY) continue;
    if (commandRight(command) <= minX || command.x >= maxX) continue;

    entries.push({
      commandIndex,
      command: offsetCommand(command, scrollX, scrollY),
    });
  }

  return entries;
}

function offsetCommand(command: DisplayCommand, scrollX: number, scrollY: number): DisplayCommand {
  return {
    ...command,
    x: command.x - scrollX,
    y: command.y - scrollY,
  };
}

/** Measure document height from laid-out text fragments only. */
export function measureContentHeight(styled: StyledNode, layout: LayoutOutput): number {
  let maxBottom = 0;

  const walk = (node: StyledNode): void => {
    for (const fragment of layout.getFragments(node)) {
      maxBottom = Math.max(maxBottom, fragment.y + fragment.height);
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(styled);
  return maxBottom;
}

/** Measure document width from a display list. */
export function measureDisplayListWidth(displayList: DisplayList): number {
  if (displayList.length === 0) return 0;
  return Math.max(...displayList.map((command) => commandRight(command)));
}

/** Measure document height from a display list. */
export function measureDisplayListHeight(displayList: DisplayList): number {
  if (displayList.length === 0) return 0;
  return Math.max(...displayList.map((command) => commandBottom(command)));
}

/** True when the viewport shows at least one command at max scroll. */
export function hasVisibleContentAtMaxScroll(
  displayList: DisplayList,
  contentHeight: number,
  viewportHeight: number,
): boolean {
  const scrollY = Math.max(0, contentHeight - viewportHeight);
  return visibleCommandEntries(displayList, 0, scrollY, Number.MAX_SAFE_INTEGER, viewportHeight).length > 0;
}
