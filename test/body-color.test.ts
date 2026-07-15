import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles, UA_BODY_FG, type StyledNode } from "../style/style";
import { NodeType } from "../dom/node";

function bodyParagraphText(styled: StyledNode): StyledNode | undefined {
  const html = styled.children[0];
  const body = html?.children.find(
    (child) => child.dom.type === NodeType.Element && child.dom.tag === "body",
  );
  const paragraph = body?.children.find(
    (child) => child.dom.type === NodeType.Element && child.dom.tag === "p",
  );
  return paragraph?.children.find((child) => child.dom.type === NodeType.Text);
}

describe("UA body text color", () => {
  test("inherits black text on light-background pages without author color", async () => {
    const styled = await computeStyles(
      convert(parseHTML(`<html><head><style>body{background:#eee}</style></head><body><p>hello</p></body></html>`)),
    );

    expect(bodyParagraphText(styled)?.style.fg).toBe(UA_BODY_FG);
  });

  test("author body color overrides the UA default", async () => {
    const styled = await computeStyles(
      convert(
        parseHTML(
          `<html><head><style>body{color:#cccccc;background:#111111}</style></head><body><p>hello</p></body></html>`,
        ),
      ),
    );

    expect(bodyParagraphText(styled)?.style.fg).toBe("#cccccc");
  });
});
