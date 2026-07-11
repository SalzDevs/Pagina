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
  attributes?: Record<string, string>;
  children?: Node[];
}
