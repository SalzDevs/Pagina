import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles } from "../style/style";

describe("computeStyles", () => {
  test("marks block elements and hides head", async () => {
    const dom = convert(parseHTML("<html><head></head><body><p>x</p></body></html>"));
    const styled = await computeStyles(dom);

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const paragraph = body?.children[0];

    expect(paragraph?.style.display).toBe("block");
    expect(styled.children[0]?.children.some((child) => child.dom.type === "element" && child.dom.tag === "head")).toBe(false);
  });

  test("applies semantic styles to inline elements", async () => {
    const dom = convert(parseHTML("<p><strong>bold</strong> <em>italic</em></p>"));
    const styled = await computeStyles(dom);

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const paragraph = body?.children[0];
    const strong = paragraph?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "strong",
    );
    const em = paragraph?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "em",
    );

    expect(strong?.style.bold).toBe(true);
    expect(em?.style.italic).toBe(true);
  });

  test("applies inline code foreground and background", async () => {
    const dom = convert(parseHTML("<p><code>bun start</code></p>"));
    const styled = await computeStyles(dom);

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const code = body?.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "code",
    );
    const text = code?.children[0];

    expect(code?.style.fg).toBe("#ce9178");
    expect(code?.style.bg).toBe("#2a2a2a");
    expect(text?.style.fg).toBe("#ce9178");
    expect(text?.style.bg).toBe("#2a2a2a");
  });
});
