export interface TextCommand {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Index into the page link list when this command belongs to an anchor. */
  linkIndex?: number;
}

export interface FillCommand {
  kind: "fill";
  x: number;
  y: number;
  width: number;
  height: number;
  bg: string;
}

export type DisplayCommand = TextCommand | FillCommand;

export type DisplayList = DisplayCommand[];

export function isTextCommand(command: DisplayCommand): command is TextCommand {
  return command.kind === "text";
}

export function isFillCommand(command: DisplayCommand): command is FillCommand {
  return command.kind === "fill";
}

export function commandBottom(command: DisplayCommand): number {
  if (isFillCommand(command)) {
    return command.y + command.height;
  }

  return command.y + 1;
}

/** Right edge of a display command in document columns. */
export function commandRight(command: DisplayCommand): number {
  if (isFillCommand(command)) {
    return command.x + command.width;
  }

  return command.x + command.text.length;
}
