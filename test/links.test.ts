import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { collectLinks } from "../links/collect";
import { linkIndexAtPoint } from "../links/hit";
import {
  applyLinkFocus,
  createLinkFocusState,
  focusNextLink,
  focusPreviousLink,
  handleLinkKey,
  scrollToFocusedLink,
} from "../links/focus";
import { loadHtmlFromFile } from "../navigation/load";
import { resolveHref } from "../navigation/resolve";
import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { layout } from "../layout/layout";
import { paint } from "../paint/paint";
import { computeStyles } from "../style/style";
import { createScrollViewport } from "../viewport/scroll";

const viewport = { width: 80, height: 24 };
const linksPagePath = resolve("examples/links-page.html");
const otherPagePath = resolve("examples/other-page.html");
const styledPagePath = resolve("examples/styled-page.html");
const homePagePath = resolve("examples/page.html");

function key(name: string, shift = false) {
  return {
    name,
    eventType: "press" as const,
    ctrl: false,
    meta: false,
    shift,
    option: false,
    sequence: "",
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

async function pipelineFromFile(path: string) {
  const html = await loadHtmlFromFile(path);
  const styled = await computeStyles(convert(parseHTML(html)), { pageLocation: resolve(path) });
  layout(styled, { viewport });
  return {
    styled,
    displayList: paint(styled).displayList,
    links: collectLinks(styled),
  };
}

async function pipeline(html: string) {
  const styled = await computeStyles(convert(parseHTML(html)));
  layout(styled, { viewport });
  return {
    styled,
    displayList: paint(styled).displayList,
    links: collectLinks(styled),
  };
}

describe("collectLinks", () => {
  test("collects anchors from examples/links-page.html in document order", async () => {
    const { links } = await pipelineFromFile("examples/links-page.html");

    expect(links).toHaveLength(3);
    expect(links[0]?.href).toBe("other-page.html");
    expect(links[1]?.href).toBe("styled-page.html");
    expect(links[2]?.href).toBe("page.html");
    expect(links[0]?.bounds[0]?.width).toBeGreaterThan(0);
  });

  test("collects the back link from examples/other-page.html", async () => {
    const { links } = await pipelineFromFile("examples/other-page.html");

    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe("links-page.html");
  });

  test("skips anchors without href or visible text", async () => {
    const { links } = await pipeline('<p><a>missing</a><a href="page.html"></a></p>');
    expect(links).toHaveLength(0);
  });
});

describe("resolveHref", () => {
  test("resolves example page links against the current file directory", () => {
    expect(resolveHref("other-page.html", linksPagePath)).toBe(otherPagePath);
    expect(resolveHref("links-page.html", otherPagePath)).toBe(linksPagePath);
    expect(resolveHref("styled-page.html", linksPagePath)).toBe(styledPagePath);
    expect(resolveHref("page.html", linksPagePath)).toBe(homePagePath);
  });

  test("returns null for unsupported href kinds", () => {
    expect(resolveHref("#section", linksPagePath)).toBeNull();
    expect(resolveHref("javascript:void(0)", linksPagePath)).toBeNull();
    expect(resolveHref("", linksPagePath)).toBeNull();
  });

  test("resolves absolute remote links", () => {
    expect(resolveHref("https://example.com/about", linksPagePath)).toBe("https://example.com/about");
  });

  test("resolves relative links against a remote page location", () => {
    expect(resolveHref("/docs", "https://example.com/page.html")).toBe("https://example.com/docs");
    expect(resolveHref("other.html", "https://example.com/docs/page.html")).toBe(
      "https://example.com/docs/other.html",
    );
  });
});

describe("link focus", () => {
  test("cycles through links-page.html and activates with enter", async () => {
    const { links } = await pipelineFromFile("examples/links-page.html");
    let state = createLinkFocusState();

    state = focusNextLink(state, links.length);
    expect(state.focusedIndex).toBe(0);
    expect(links[0]?.href).toBe("other-page.html");

    state = focusNextLink(state, links.length);
    expect(state.focusedIndex).toBe(1);
    expect(links[1]?.href).toBe("styled-page.html");

    state = focusPreviousLink(state, links.length);
    expect(state.focusedIndex).toBe(0);

    const activate = handleLinkKey(state, links.length, key("return"));
    expect(activate).toEqual({ kind: "activate", index: 0 });
    expect(resolveHref(links[0]!.href, linksPagePath)).toBe(otherPagePath);
  });

  test("uses bracket keys to move between links-page.html links", async () => {
    const { links } = await pipelineFromFile("examples/links-page.html");
    let state = createLinkFocusState();

    const first = handleLinkKey(state, links.length, key("]"));
    expect(first?.kind).toBe("focus");
    state = first!.kind === "focus" ? first.state : state;
    expect(state.focusedIndex).toBe(0);

    const second = handleLinkKey(state, links.length, key("]"));
    expect(second?.kind).toBe("focus");
    state = second!.kind === "focus" ? second.state : state;
    expect(state.focusedIndex).toBe(1);

    const previous = handleLinkKey(state, links.length, key("["));
    expect(previous?.kind).toBe("focus");
    state = previous!.kind === "focus" ? previous.state : state;
    expect(state.focusedIndex).toBe(0);
  });

  test("activates the styled-page link with o", async () => {
    const { links } = await pipelineFromFile("examples/links-page.html");
    const state = { focusedIndex: 1 };

    expect(handleLinkKey(state, links.length, key("o"))).toEqual({ kind: "activate", index: 1 });
    expect(links[1]?.href).toBe("styled-page.html");
    expect(resolveHref(links[1]!.href, linksPagePath)).toBe(styledPagePath);
  });

  test("applies focus styling to one link at a time", () => {
    const displayList = [
      { kind: "text" as const, x: 0, y: 0, text: "plain", linkIndex: undefined },
      { kind: "text" as const, x: 0, y: 1, text: "other page", linkIndex: 0 },
      { kind: "text" as const, x: 0, y: 2, text: "styled page", linkIndex: 1 },
    ];

    const focused = applyLinkFocus(displayList, 1);
    expect(focused[0]?.bg).toBeUndefined();
    expect(focused[1]?.bg).toBeUndefined();
    expect(focused[2]?.bg).toBe("#264f78");
  });

  test("scrolls the viewport to reveal a link on examples/long-page.html", async () => {
    const { links } = await pipelineFromFile("examples/long-page.html");
    const link = links[0];
    expect(link).toBeDefined();

    const viewportState = createScrollViewport(10, 50);
    const next = scrollToFocusedLink(viewportState, link!);

    expect(next.scrollY).toBeGreaterThan(0);
  });
});

describe("paint linkIndex", () => {
  test("tags display commands for links-page.html anchors", async () => {
    const { displayList } = await pipelineFromFile("examples/links-page.html");
    const otherPageCommands = displayList.filter(
      (command) => command.kind === "text" && command.linkIndex === 0,
    );
    const styledPageCommands = displayList.filter(
      (command) => command.kind === "text" && command.linkIndex === 1,
    );

    expect(otherPageCommands.some((command) => command.text.includes("other"))).toBe(true);
    expect(styledPageCommands.some((command) => command.text.includes("styled"))).toBe(true);
    expect(displayList.some((command) => command.linkIndex === undefined)).toBe(true);
  });

  test("assigns a unique index to each links-page.html anchor", async () => {
    const { displayList } = await pipelineFromFile("examples/links-page.html");

    expect(
      displayList.some(
        (command) =>
          command.kind === "text" &&
          command.linkIndex === 0 &&
          command.text.toLowerCase().includes("other"),
      ),
    ).toBe(true);
    expect(
      displayList.some(
        (command) =>
          command.kind === "text" &&
          command.linkIndex === 1 &&
          command.text.toLowerCase().includes("styled"),
      ),
    ).toBe(true);
    expect(
      displayList.some(
        (command) =>
          command.kind === "text" &&
          command.linkIndex === 2 &&
          command.text.toLowerCase().includes("home"),
      ),
    ).toBe(true);
  });
});

describe("linkIndexAtPoint", () => {
  test("finds the other-page link under its layout bounds", async () => {
    const { links } = await pipelineFromFile("examples/links-page.html");
    const link = links[0];
    const bound = link?.bounds[0];

    expect(link?.href).toBe("other-page.html");
    expect(bound).toBeDefined();

    expect(linkIndexAtPoint(links, bound!.x, bound!.y)).toBe(0);
    expect(linkIndexAtPoint(links, bound!.x + bound!.width + 5, bound!.y)).toBeNull();
  });
});
