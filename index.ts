import { createCliRenderer, Text } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";
import * as parse5 from "parse5";
import type { Document } from "parse5";

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
}

function convert(node: any, parent?: Node): Node {
  let current: Node;

  switch (node.nodeName) {
    case "#document":
      current = {
        type: NodeType.Document,
        parent,
        children: [],
      };
      break;

    case "#text":
      current = {
        type: NodeType.Text,
        parent,
        value: node.value,
      };
      break;

    case "#comment":
      current = {
        type: NodeType.Comment,
        parent,
        value: node.data,
      };
      break;

    case "#documentType":
      current = {
        type: NodeType.Doctype,
        parent,
        value: node.name,
      };
      break;

    default:
      if (!node.tagName) {
        throw new Error(`Unknown node type: ${node.nodeName}`);
      }

      current = {
        type: NodeType.Element,
        parent,
        tag: node.tagName,
        children: [],
      };
  }

  if (current.children && node.childNodes) {
    current.children = node.childNodes.map((child: any) =>
      convert(child, current),
    );
  }

  return current;
}

function render(renderer: CliRenderer, node: Node): void {
  switch (node.type) {
    case NodeType.Document:
      renderChildren(renderer, node);
      break;

    case NodeType.Element:
      renderElement(renderer, node);
      break;

    case NodeType.Text:
      if (node.value && node.value.trim().length > 0) {
        renderer.root.add(
          Text({
            content: node.value,
          }),
        );
      }
      break;

    case NodeType.Comment:
    case NodeType.Doctype:
      break;
  }
}

function renderChildren(renderer: CliRenderer, node: Node): void {
  if (!node.children) return;

  for (const child of node.children) {
    render(renderer, child);
  }
}

function renderElement(renderer: CliRenderer, node: Node): void {
  switch (node.tag) {
    case "html":
    case "body":
    case "div":
      renderChildren(renderer, node);
      break;

    case "h1":
      renderer.root.add(Text({ content: "\n" }));
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "h2":
      renderer.root.add(Text({ content: "\n" }));
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "p":
      renderChildren(renderer, node);
      renderer.root.add(Text({ content: "\n\n" }));
      break;

    case "br":
      renderer.root.add(Text({ content: "\n" }));
      break;

    default:
      renderChildren(renderer, node);
      break;
  }
}

const html = `
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello!</h1>
    <p>This is <strong>OpenTUI</strong>.</p>
  </body>
</html>
`;

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  const document: Document = parse5.parse(html);

  const dom = convert(document);

  render(renderer, dom);

  renderer.start();
}

await main();
