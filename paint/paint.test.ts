import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "./paint";

describe("paint", () => {
  test("emits display commands from laid-out text nodes", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    const dom = convert(parseHTML(html));

    layout(dom);
    const displayList = paint(dom);

    expect(displayList.length).toBeGreaterThan(0);
    expect(displayList.some((cmd) => cmd.text.includes("Hello"))).toBe(true);
    expect(displayList.some((cmd) => cmd.text.includes("world"))).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.x === "number")).toBe(true);
    expect(displayList.every((cmd) => typeof cmd.y === "number")).toBe(true);
  });

  test("uses layout positions for each command", () => {
    const html = "<p>ab</p>";
    const dom = convert(parseHTML(html));

    layout(dom);
    const displayList = paint(dom);

    expect(displayList[0]).toEqual({
      x: 0,
      y: 0,
      text: "ab",
    });
  });
});
