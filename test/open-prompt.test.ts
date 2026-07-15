import { describe, expect, test } from "bun:test";

import {
  applyOpenPromptKey,
  activateOpenPrompt,
  createOpenPromptState,
  formatOpenPromptBreadcrumb,
  isOpenPromptToggleKey,
} from "../viewport/open-prompt";
import { OpenPromptHistory } from "../viewport/open-prompt-history";
import { BookmarkStore } from "../config/bookmarks";

function key(
  name: string,
  options: {
    shift?: boolean;
    ctrl?: boolean;
    meta?: boolean;
    sequence?: string;
  } = {},
) {
  return {
    name,
    eventType: "press" as const,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    option: false,
    sequence: options.sequence ?? name,
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

function promptContext(
  history = new OpenPromptHistory(),
  bookmarks?: BookmarkStore,
) {
  return { history, bookmarks, cwd: process.cwd() };
}

describe("open prompt", () => {
  test("opens on colon", () => {
    const history = new OpenPromptHistory();
    expect(isOpenPromptToggleKey(key(":"))).toBe(true);
    expect(isOpenPromptToggleKey(key("j"))).toBe(false);

    const result = applyOpenPromptKey(createOpenPromptState(), key(":"), promptContext(history));
    expect(result).toEqual({ kind: "open", state: activateOpenPrompt(history) });
  });

  test("accepts typed input and submits a location with fragment", () => {
    let state = activateOpenPrompt(new OpenPromptHistory());

    state = applyTyped(state, "e", "x", "a", "m", "p", "l", "e", "s", "/", "p", "a", "g", "e", ".", "h", "t", "m", "l", "#", "i", "n", "t", "r", "o");
    const submit = applyOpenPromptKey(state, key("return"), promptContext());

    expect(submit).toEqual({
      kind: "submit",
      location: "examples/page.html",
      fragment: "intro",
    });
  });

  test("cancels on escape or empty submit", () => {
    const state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "  ", cursor: 2 };

    expect(applyOpenPromptKey(state, key("escape"), promptContext())).toEqual({ kind: "cancel" });
    expect(applyOpenPromptKey(state, key("return"), promptContext())).toEqual({ kind: "cancel" });
  });

  test("deletes characters with backspace and delete", () => {
    let state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "ab", cursor: 2 };
    const backspace = applyOpenPromptKey(state, key("backspace"), promptContext());

    expect(backspace).toEqual({
      kind: "update",
      state: { ...state, value: "a", cursor: 1, historyPosition: 0, historyDraft: "" },
    });

    state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "ab", cursor: 1 };
    const del = applyOpenPromptKey(state, key("delete"), promptContext());
    expect(del).toEqual({
      kind: "update",
      state: { ...state, value: "a", cursor: 1, historyPosition: 0, historyDraft: "" },
    });
  });

  test("moves the cursor with arrow, home, and end keys", () => {
    let state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "abc", cursor: 1 };

    state = updateState(applyOpenPromptKey(state, key("left"), promptContext()));
    expect(state.cursor).toBe(0);

    state = updateState(applyOpenPromptKey(state, key("end"), promptContext()));
    expect(state.cursor).toBe(3);

    state = updateState(applyOpenPromptKey(state, key("home"), promptContext()));
    expect(state.cursor).toBe(0);
  });

  test("inserts pasted text from bracketed paste sequences", () => {
    const state = activateOpenPrompt(new OpenPromptHistory());
    const result = applyOpenPromptKey(
      state,
      key("paste", { sequence: "\x1b[200~https://example.com/docs\x1b[201~" }),
      promptContext(),
    );

    expect(result).toEqual({
      kind: "update",
      state: {
        ...state,
        value: "https://example.com/docs",
        cursor: 24,
        historyPosition: 0,
        historyDraft: "",
      },
    });
  });

  test("recalls history entries with up and down", () => {
    const history = new OpenPromptHistory();
    history.add("examples/page.html");
    history.add("examples/links-page.html");

    let state = { ...activateOpenPrompt(history), value: "draft", cursor: 5 };

    state = updateState(applyOpenPromptKey(state, key("up"), promptContext(history)));
    expect(state.value).toBe("examples/links-page.html");

    state = updateState(applyOpenPromptKey(state, key("up"), promptContext(history)));
    expect(state.value).toBe("examples/page.html");

    state = updateState(applyOpenPromptKey(state, key("down"), promptContext(history)));
    expect(state.value).toBe("examples/links-page.html");

    state = updateState(applyOpenPromptKey(state, key("down"), promptContext(history)));
    expect(state.value).toBe("draft");
  });

  test("expands tilde on submit", () => {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    if (home.length === 0) return;

    const state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "~/", cursor: 2 };
    const result = applyOpenPromptKey(state, key("return"), promptContext());
    expect(result).toEqual({
      kind: "submit",
      location: home,
      fragment: null,
    });
  });

  test("opens bookmarks with @name from the open prompt", () => {
    const bookmarks = new BookmarkStore([{ name: "docs", location: "examples/page.html" }]);
    const state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "@docs", cursor: 5 };
    const result = applyOpenPromptKey(state, key("return"), promptContext(new OpenPromptHistory(), bookmarks));

    expect(result).toEqual({
      kind: "submit",
      location: "examples/page.html",
      fragment: null,
    });
  });

  test("tab-completes bookmark names in the open prompt", () => {
    const bookmarks = new BookmarkStore([
      { name: "docs", location: "examples/page.html" },
      { name: "downloads", location: "examples/other-page.html" },
    ]);
    const state = { ...activateOpenPrompt(new OpenPromptHistory()), value: "@doc", cursor: 4 };
    const result = applyOpenPromptKey(state, key("tab"), promptContext(new OpenPromptHistory(), bookmarks));

    expect(result).toEqual({
      kind: "update",
      state: {
        ...state,
        value: "@docs",
        cursor: 5,
        historyPosition: 0,
        historyDraft: "",
      },
    });
  });

  test("formats the breadcrumb prompt line and truncates long input", () => {
    expect(formatOpenPromptBreadcrumb("examples/page.html", 40)).toBe(
      "Open: examples/page.html_",
    );

    const line = formatOpenPromptBreadcrumb(
      "https://example.com/very/long/path/to/a/page.html",
      24,
    );
    expect(line.length).toBeLessThanOrEqual(24);
    expect(line.startsWith("Open: ...")).toBe(true);
    expect(line.endsWith("_")).toBe(true);
  });
});

function applyTyped(
  state: ReturnType<typeof createOpenPromptState>,
  ...chars: string[]
) {
  let next = state;
  for (const char of chars) {
    const result = applyOpenPromptKey(next, key(char), promptContext());
    if (result.kind !== "update") {
      throw new Error(`Expected update while typing ${char}`);
    }
    next = result.state;
  }
  return next;
}

function updateState(result: ReturnType<typeof applyOpenPromptKey>) {
  if (result.kind !== "update") {
    throw new Error(`Expected update, got ${result.kind}`);
  }
  return result.state;
}
