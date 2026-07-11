import type { CliRenderer } from "@opentui/core";
import { Text, createTextAttributes } from "@opentui/core";

import type { DisplayList } from "../paint/display-list";

/** Draw a display list using OpenTUI. Knows nothing about HTML or the DOM. */
export function render(renderer: CliRenderer, displayList: DisplayList): void {
  for (const [index, command] of displayList.entries()) {
    if (command.text.length === 0) continue;

    renderer.root.add(
      Text({
        id: `display-cmd-${index}`,
        content: command.text,
        position: "absolute",
        left: command.x,
        top: command.y,
        fg: command.fg,
        bg: command.bg,
        attributes: createTextAttributes({
          bold: command.bold,
        }),
        selectable: false,
      }),
    );
  }
}
