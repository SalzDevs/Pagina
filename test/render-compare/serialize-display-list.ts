import { resolve } from "node:path";

import { loadPageContent } from "../../navigation/load-page";
import type { DisplayCommand, DisplayList } from "../../paint/display-list";
import { isFillCommand, isTextCommand } from "../../paint/display-list";
import { buildPageView } from "../../viewport/page-view";

function serializeTextCommand(command: Extract<DisplayCommand, { kind: "text" }>): string {
  const attrs: string[] = [];
  if (command.fg) attrs.push(`fg=${command.fg}`);
  if (command.bg) attrs.push(`bg=${command.bg}`);
  if (command.bold) attrs.push("bold");
  if (command.italic) attrs.push("italic");
  if (command.underline) attrs.push("underline");
  if (command.linkIndex !== undefined) attrs.push(`link=${command.linkIndex}`);

  const suffix = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `text ${command.x},${command.y} ${JSON.stringify(command.text)}${suffix}`;
}

function serializeFillCommand(command: Extract<DisplayCommand, { kind: "fill" }>): string {
  return `fill ${command.x},${command.y} ${command.width}x${command.height} bg=${command.bg}`;
}

/** Serialize a display list into a stable, reviewable golden format. */
export function serializeDisplayList(displayList: DisplayList): string {
  return displayList
    .map((command) => {
      if (isTextCommand(command)) return serializeTextCommand(command);
      if (isFillCommand(command)) return serializeFillCommand(command);
      return String(command);
    })
    .join("\n");
}

/** Build and serialize the painted display list for a page at a viewport. */
export async function buildDisplayListSnapshot(
  pagePath: string,
  viewport: { width: number; height: number },
): Promise<string> {
  const resolved = resolve(pagePath);
  const page = await loadPageContent(resolved, { viewportWidth: viewport.width });
  const view = buildPageView(page.styled, viewport);
  return serializeDisplayList(view.displayList);
}
