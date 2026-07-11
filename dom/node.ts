import type { LayoutBox } from "../layout/layout";

export enum NodeType {
  Document = "document",
  Element = "element",
  Text = "text",
  Comment = "comment",
  Doctype = "doctype",
}

export interface Node {
  type: NodeType;
  parent?: Node;
  value?: string;
  tag?: string;
  children?: Node[];
  layout?: LayoutBox;
}
