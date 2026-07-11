export interface DisplayCommand {
  x: number;
  y: number;

  text: string;

  fg?: string;
  bg?: string;

  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type DisplayList = DisplayCommand[];
