import type { CliRenderer } from "@opentui/core";
import { Text, createTextAttributes } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";
import { visibleCommands } from "../viewport/visible";

export interface RenderOptions {
  scrollY?: number;
  viewportHeight?: number;
}

export function clearRenderer(renderer: CliRenderer): void {
  for (const child of renderer.root.getChildren()) {
    renderer.root.remove(child);
  }
}

/** Draw a display list using OpenTUI. Knows nothing about HTML or the DOM. */
export function render(
  renderer: CliRenderer,
  displayList: DisplayList,
  options: RenderOptions = {},
): void {
  const scrollY = options.scrollY ?? 0;
  const viewportHeight = options.viewportHeight ?? Number.POSITIVE_INFINITY;
  const commands = visibleCommands(displayList, scrollY, viewportHeight);

  for (const [index, command] of commands.entries()) {
    if (command.text.length === 0) continue;

    renderer.root.add(
      Text({
        id: `display-cmd-${scrollY}-${index}`,
        content: command.text,
        position: "absolute",
        left: command.x,
        top: command.y,
        fg: command.fg,
        bg: command.bg,
        attributes: createTextAttributes({
          bold: command.bold,
          italic: command.italic,
          underline: command.underline,
        }),
        selectable: false,
      }),
    );
  }
}
