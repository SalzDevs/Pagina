import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles } from "../style/style";
import { buildPageView } from "../viewport/page-view";
import { clampScrollY, maxScrollY } from "../viewport/scroll";

describe("history scroll restore", () => {
  test("clamps restored scroll when content height changes after refetch", async () => {
    const html = "<p>one two three four five six seven eight nine ten</p>";
    const styled = await computeStyles(convert(parseHTML(html)));

    const tall = buildPageView(styled, { width: 8, height: 10 });
    const savedScrollY = tall.contentHeight - 1;

    const short = buildPageView(styled, { width: 40, height: 10 });
    const restored = clampScrollY(
      {
        scrollX: 0,
        scrollY: savedScrollY,
        viewportWidth: 40,
        viewportHeight: 10,
        contentWidth: short.contentWidth,
        contentHeight: short.contentHeight,
      },
      savedScrollY,
    );

    expect(restored).toBe(maxScrollY({
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 40,
      viewportHeight: 10,
      contentWidth: short.contentWidth,
      contentHeight: short.contentHeight,
    }));
  });
});
