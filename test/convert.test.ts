import { describe, expect, test } from "bun:test";
import * as parse5 from "parse5";

import { NodeType } from "../dom/node";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";

describe("convert", () => {
  test("converts a parsed document tree", () => {
    const document = parseHTML("<!DOCTYPE html><html><body><p>Hi</p></body></html>");
    const dom = convert(document);

    expect(dom.type).toBe(NodeType.Document);
    const html = dom.children?.[1];
    expect(html?.type).toBe(NodeType.Element);
    expect(html?.tag).toBe("html");

    const body = html?.children?.find((child) => child.tag === "body");
    const paragraph = body?.children?.find((child) => child.tag === "p");
    const text = paragraph?.children?.[0];

    expect(text?.type).toBe(NodeType.Text);
    expect(text?.value).toBe("Hi");
  });

  test("preserves element attributes", () => {
    const dom = convert(parse5.parseFragment('<a id="home" href="/">Go</a>'));
    const link = dom.children?.[0];

    expect(link?.type).toBe(NodeType.Element);
    expect(link?.tag).toBe("a");
    expect(link?.attributes).toEqual({ id: "home", href: "/" });
  });

  test("converts comments and doctypes", () => {
    const dom = convert(parseHTML("<!-- note --><!DOCTYPE html><p>x</p>"));

    expect(dom.children?.[0]?.type).toBe(NodeType.Comment);
    expect(dom.children?.[0]?.value).toBe(" note ");
    expect(dom.children?.[1]?.type).toBe(NodeType.Doctype);
    expect(dom.children?.[1]?.value).toBe("html");
  });

  test("converts document fragments from parse5", () => {
    const fragment = parse5.parseFragment("<span>one</span><span>two</span>");
    const dom = convert(fragment);

    expect(dom.type).toBe(NodeType.Document);
    expect(dom.children?.map((child) => child.tag)).toEqual(["span", "span"]);
  });
});
