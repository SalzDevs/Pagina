export type SimpleSelector =
  | { kind: "tag"; tag: string }
  | { kind: "class"; className: string }
  | { kind: "id"; id: string }
  | { kind: "tag-class"; tag: string; className: string }
  | { kind: "tag-id"; tag: string; id: string };

export type CssSelector = SimpleSelector | { kind: "descendant"; chain: SimpleSelector[] };

export interface CssRule {
  selectors: CssSelector[];
  declarations: CssDeclarations;
}

export interface CssDeclarations {
  color?: string;
  background?: string;
  backgroundColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  fontSize?: number;
  textDecoration?: string;
  display?: string;
  whiteSpace?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginLeftAuto?: boolean;
  marginRightAuto?: boolean;
  width?: number;
  opacity?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  customProperties?: Record<string, string>;
}
