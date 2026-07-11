import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { computeStyles } from "../style/style";

const viewport = { width: 80, height: 24 };

describe("paint", () => {
  test("emits display commands from laid-out text nodes", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport });
    const displayList = paint(styled);

    expect(displayList.length).toBeGreaterThan(0);
    expect(displayList.some((cmd) => cmd.text.includes("Hello"))).toBe(true);
    expect(displayList.some((cmd) => cmd.text.includes("world"))).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.x === "number")).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.y === "number")).toBe(true);
  });

  test("uses layout positions for each command", () => {
    const html = "<p>ab</p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport });
    const displayList = paint(styled);

    expect(displayList[0]).toEqual({
      x: 0,
      y: 0,
      text: "ab",
      bold: undefined,
      italic: undefined,
      underline: undefined,
    });
  });

  test("applies computed styles to display commands", () => {
    const html = "<p><strong>bold</strong></p>";
    const styled = computeStyles(convert(parseHTML(html)));

    layout(styled, { viewport });
    const displayList = paint(styled);

    expect(displayList.some((cmd) => cmd.text.includes("bold") && cmd.bold)).toBe(true);
  });
});
