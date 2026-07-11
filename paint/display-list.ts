export interface DisplayCommand {
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

export type DisplayList = DisplayCommand[];
