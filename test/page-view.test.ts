import { describe, expect, test } from "bun:test";

import { layout } from "../layout/layout";
import { collectLinks } from "../links/collect";
import { collectFragmentPositions } from "../navigation/anchors";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { paint } from "../paint/paint";
import { computeStyles } from "../style/style";
import { buildPageView } from "../viewport/page-view";
import { measureContentHeight } from "../viewport/visible";

describe("buildPageView merged passes", () => {
  test("collects links and fragment positions without extra tree walks", async () => {
    const html = await Bun.file("examples/fragments-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const viewport = { width: 80, height: 24 };

    const view = buildPageView(styled, viewport);
    const laidOut = layout(styled, { viewport });

    expect(view.links).toEqual(collectLinks(styled, laidOut.output));
    expect(view.fragmentPositions).toEqual(collectFragmentPositions(styled, laidOut.output));
    expect(view.contentHeight).toBeGreaterThanOrEqual(measureContentHeight(styled, laidOut.output));
  });

  test("paint returns links in document order", async () => {
    const html = await Bun.file("examples/links-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)));
    const laidOut = layout(styled, { viewport: { width: 80, height: 24 } });

    const painted = paint(styled, laidOut.output, { viewportHeight: 24 });

    expect(painted.links).toEqual(collectLinks(styled, laidOut.output));
    expect(painted.contentHeight).toBeGreaterThan(0);
  });
});
