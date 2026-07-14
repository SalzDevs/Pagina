import { describe, expect, test } from "bun:test";

import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { handleHistoryKey } from "../navigation/history-keys";
import {
  createBrowserHistory,
  extractPageTitle,
  formatBreadcrumb,
  formatBreadcrumbWithStatus,
  formatCssWarningStatus,
  formatLoadingBreadcrumb,
  goBack,
  goForward,
  historyLabel,
  pushHistory,
  updateCurrentHistoryEntry,
} from "../navigation/history";

function key(name: string, options: { shift?: boolean; option?: boolean } = {}) {
  return {
    name,
    eventType: "press" as const,
    ctrl: false,
    meta: false,
    shift: options.shift ?? false,
    option: options.option ?? false,
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

describe("browser history", () => {
  test("pushes entries and truncates forward history on navigation", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "A" });
    history = pushHistory(history, { location: "/b", label: "B" });

    expect(history.entries.map((entry) => entry.label)).toEqual(["A", "B"]);
    expect(history.index).toBe(1);

    const back = goBack(history);
    history = back.history;
    expect(back.entry?.location).toBe("/a");

    history = pushHistory(history, { location: "/c", label: "C" });
    expect(history.entries.map((entry) => entry.label)).toEqual(["A", "C"]);
    expect(history.index).toBe(1);
  });

  test("moves back and forward through entries", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "A" });
    history = pushHistory(history, { location: "/b", label: "B" });
    history = pushHistory(history, { location: "/c", label: "C" });

    history = goBack(history).history;
    history = goBack(history).history;
    expect(history.index).toBe(0);

    history = goForward(history).history;
    expect(history.index).toBe(1);
    expect(goForward(history).entry?.label).toBe("C");
  });

  test("formats breadcrumb labels with the current entry highlighted", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });
    history = pushHistory(history, { location: "/b", label: "Other" });

    expect(formatBreadcrumb(history, 40)).toBe("Home › [Other]");
  });

  test("truncates long breadcrumbs from the left", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "First Page" });
    history = pushHistory(history, { location: "/b", label: "Second Page" });
    history = pushHistory(history, { location: "/c", label: "Current Page" });

    const line = formatBreadcrumb(history, 24);
    expect(line).toContain("[Current Page]");
    expect(line.startsWith("...")).toBe(true);
  });

  test("formats loading labels for remote and local locations", () => {
    expect(formatLoadingBreadcrumb("https://example.com/docs/page.html", 40)).toBe(
      "Loading example.com/docs/page.html…",
    );
    expect(formatLoadingBreadcrumb("/tmp/examples/page.html", 40)).toBe("Loading page.html…");
  });

  test("truncates long loading labels", () => {
    const line = formatLoadingBreadcrumb("https://example.com/very/long/path/to/a/page.html", 20);
    expect(line.endsWith("...")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(20);
    expect(line.startsWith("Loading ")).toBe(true);
  });

  test("appends CSS failure status to the breadcrumb", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });

    expect(formatCssWarningStatus(["https://example.com/theme.css"], 40)).toBe(
      " | ⚠ CSS failed: example.com/theme.css",
    );
    expect(
      formatBreadcrumbWithStatus(history, 60, {
        cssWarnings: ["https://example.com/theme.css"],
      }),
    ).toBe("[Home] | ⚠ CSS failed: example.com/theme.css");
  });

  test("summarizes multiple CSS failures in the breadcrumb", () => {
    expect(formatCssWarningStatus(["https://a.test/one.css", "https://a.test/two.css"], 40)).toBe(
      " | ⚠ 2 CSS files failed",
    );
  });

  test("stores and restores scroll position on the active entry", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "A" });
    history = updateCurrentHistoryEntry(history, { scrollY: 42 });
    history = pushHistory(history, { location: "/b", label: "B" });
    history = updateCurrentHistoryEntry(history, { scrollY: 17 });

    const back = goBack(history);
    expect(back.entry?.location).toBe("/a");
    expect(back.entry?.scrollY).toBe(42);

    history = back.history;
    history = updateCurrentHistoryEntry(history, { scrollY: 50 });

    const forward = goForward(history);
    expect(forward.entry?.location).toBe("/b");
    expect(forward.entry?.scrollY).toBe(17);
  });
});

describe("history labels", () => {
  test("prefers the document title", () => {
    const dom: Node = {
      type: NodeType.Element,
      tag: "html",
      children: [
        {
          type: NodeType.Element,
          tag: "head",
          children: [
            {
              type: NodeType.Element,
              tag: "title",
              children: [{ type: NodeType.Text, value: "Links Demo" }],
            },
          ],
        },
      ],
    };

    expect(extractPageTitle(dom)).toBe("Links Demo");
    expect(historyLabel("examples/links-page.html", "Links Demo")).toBe("Links Demo");
  });

  test("falls back to the first h1 when title is missing", () => {
    const dom: Node = {
      type: NodeType.Element,
      tag: "html",
      children: [
        {
          type: NodeType.Element,
          tag: "body",
          children: [
            {
              type: NodeType.Element,
              tag: "h1",
              children: [{ type: NodeType.Text, value: "Hello!" }],
            },
          ],
        },
      ],
    };

    expect(extractPageTitle(dom)).toBe("Hello!");
  });

  test("falls back to h2 when title and h1 are missing", () => {
    const dom: Node = {
      type: NodeType.Element,
      tag: "html",
      children: [
        {
          type: NodeType.Element,
          tag: "body",
          children: [
            {
              type: NodeType.Element,
              tag: "h2",
              children: [{ type: NodeType.Text, value: "Chapter One" }],
            },
          ],
        },
      ],
    };

    expect(extractPageTitle(dom)).toBe("Chapter One");
  });

  test("prefers title over h1 when both are present", () => {
    const dom: Node = {
      type: NodeType.Element,
      tag: "html",
      children: [
        {
          type: NodeType.Element,
          tag: "head",
          children: [
            {
              type: NodeType.Element,
              tag: "title",
              children: [{ type: NodeType.Text, value: "Document Title" }],
            },
          ],
        },
        {
          type: NodeType.Element,
          tag: "body",
          children: [
            {
              type: NodeType.Element,
              tag: "h1",
              children: [{ type: NodeType.Text, value: "Heading Title" }],
            },
          ],
        },
      ],
    };

    expect(extractPageTitle(dom)).toBe("Document Title");
  });

  test("falls back to hostname or file name", () => {
    expect(historyLabel("https://example.com/docs/page.html")).toBe("example.com/docs/page.html");
    expect(historyLabel("/tmp/examples/page.html")).toBe("page.html");
  });
});

describe("handleHistoryKey", () => {
  test("binds u and shift+u to back and forward", () => {
    expect(handleHistoryKey(key("u"))).toBe("back");
    expect(handleHistoryKey(key("u", { shift: true }))).toBe("forward");
  });

  test("binds option+arrow keys to back and forward", () => {
    expect(handleHistoryKey(key("left", { option: true }))).toBe("back");
    expect(handleHistoryKey(key("right", { option: true }))).toBe("forward");
  });
});
