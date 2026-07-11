export type CssSelector =
  | { kind: "tag"; tag: string }
  | { kind: "class"; className: string }
  | { kind: "id"; id: string }
  | { kind: "tag-class"; tag: string; className: string }
  | { kind: "tag-id"; tag: string; id: string };

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
  textDecoration?: string;
  display?: string;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingBottom?: number;
}
