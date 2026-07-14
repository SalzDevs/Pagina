import { describe, expect, test } from "bun:test";

import type { Node } from "../dom/node";
import { NodeType } from "../dom/node";
import { handleHistoryKey } from "../navigation/history-keys";
import {
  createBrowserHistory,
  extractPageTitle,
  formatBreadcrumb,
  formatBreadcrumbWithStatus,
  formatCssWarningHelpSection,
  formatCssWarningStatus,
  formatFragmentNotFoundStatus,
  formatLoadingBreadcrumb,
  formatLoadCancelledBreadcrumb,
  formatUnsupportedLinkStatus,
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

  test("shows Esc hint for cancellable remote loads", () => {
    expect(formatLoadingBreadcrumb("https://example.com/page.html", 80, { cancellable: true })).toBe(
      "Loading example.com/page.html… (Esc to cancel)",
    );
  });

  test("formats load-cancelled breadcrumb", () => {
    expect(formatLoadCancelledBreadcrumb(40)).toBe("Loading cancelled");
  });

  test("formats fragment-not-found status for the breadcrumb", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Fragments" });

    expect(formatFragmentNotFoundStatus("does-not-exist", 40)).toBe(
      " | ⚠ #does-not-exist not found",
    );
    expect(
      formatBreadcrumbWithStatus(history, 50, {
        fragmentNotFound: "does-not-exist",
      }),
    ).toBe("[Fragments] | ⚠ #does-not-exist not found");
  });

  test("formats unsupported link status for the breadcrumb", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Contact" });

    expect(formatUnsupportedLinkStatus("mailto:test@example.com", 40)).toBe(
      " | ⚠ mailto: links not supported",
    );
    expect(
      formatBreadcrumbWithStatus(history, 50, {
        unsupportedLink: "mailto:test@example.com",
      }),
    ).toBe("[Contact] | ⚠ mailto: links not supported");
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

  test("uses compact css warning labels on narrow widths", () => {
    expect(
      formatCssWarningStatus(
        ["https://example.com/very/long/path/to/theme.css"],
        14,
      ),
    ).toBe(" | ⚠ CSS");

    expect(formatCssWarningStatus(["https://a.test/one.css", "https://a.test/two.css"], 12)).toBe(
      " | ⚠ CSS×2",
    );
  });

  test("prioritizes breadcrumb trail over css status on narrow widths", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "First Page" });
    history = pushHistory(history, { location: "/b", label: "Second Page" });
    history = pushHistory(history, { location: "/c", label: "Current Page" });

    const line = formatBreadcrumbWithStatus(history, 24, {
      cssWarnings: ["https://example.com/very/long/path/theme.css"],
    });

    expect(line).toContain("Current Page");
    expect(line.startsWith("...")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(24);
    expect(line).toContain("⚠");
  });

  test("keeps a css warning visible when the breadcrumb needs most of the width", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "First Page" });
    history = pushHistory(history, { location: "/b", label: "Second Page" });
    history = pushHistory(history, { location: "/c", label: "Current Page" });

    const line = formatBreadcrumbWithStatus(history, 18, {
      cssWarnings: ["https://example.com/theme.css"],
    });

    expect(line).toContain("Current");
    expect(line).toContain("⚠");
    expect(line.length).toBeLessThanOrEqual(18);
  });

  test("lists failed stylesheet urls in the help section", () => {
    const lines = formatCssWarningHelpSection(
      ["https://example.com/theme.css", "https://cdn.example.com/extra.css"],
      60,
    );

    expect(lines.join("\n")).toContain("Failed stylesheets:");
    expect(lines.join("\n")).toContain("example.com/theme.css");
    expect(lines.join("\n")).toContain("cdn.example.com/extra.css");
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

  test("stores and restores link focus and visit fragment on the active entry", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, {
      location: "/docs",
      label: "Docs",
      fragment: "intro",
    });
    history = updateCurrentHistoryEntry(history, {
      scrollY: 12,
      focusedLinkIndex: 3,
    });
    history = pushHistory(history, { location: "/about", label: "About" });

    const back = goBack(history);
    expect(back.entry).toEqual({
      location: "/docs",
      label: "Docs",
      fragment: "intro",
      scrollY: 12,
      focusedLinkIndex: 3,
    });
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
