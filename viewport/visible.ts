import type { DisplayCommand, DisplayList } from "../paint/display-list";

/** Measure document height in terminal rows from a display list. */
export function measureContentHeight(displayList: DisplayList): number {
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
