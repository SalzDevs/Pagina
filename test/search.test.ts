import { describe, expect, test } from "bun:test";

import type { DisplayList } from "../paint/display-list";
import {
  activateSearchPrompt,
  applySearchKey,
  createSearchState,
  findSearchMatches,
  formatSearchPromptBreadcrumb,
  formatSearchStatus,
  isSearchToggleKey,
  stepSearchMatchIndex,
} from "../viewport/search";

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

const sampleDisplayList: DisplayList = [
  { kind: "text", x: 0, y: 0, text: "Hello world" },
  { kind: "text", x: 0, y: 1, text: "Another hello there" },
  { kind: "fill", x: 0, y: 2, width: 10, height: 1, bg: "#000000" },
];

describe("search", () => {
  test("opens on slash and ctrl+f", () => {
    expect(isSearchToggleKey(key("/"))).toBe(true);
    expect(isSearchToggleKey(key("f", { ctrl: true }))).toBe(true);
    expect(isSearchToggleKey(key("j"))).toBe(false);

    const opened = applySearchKey(createSearchState(), key("/"));
    expect(opened).toEqual({ kind: "open", state: activateSearchPrompt(createSearchState()) });
  });

  test("finds every case-insensitive match in text commands", () => {
    expect(findSearchMatches(sampleDisplayList, "")).toEqual([]);
    expect(findSearchMatches(sampleDisplayList, "hello")).toEqual([
      { commandIndex: 0, start: 0, length: 5, y: 0, x: 0 },
      { commandIndex: 1, start: 8, length: 5, y: 1, x: 8 },
    ]);
  });

  test("submits query and navigates matches", () => {
    let state = activateSearchPrompt(createSearchState());

    for (const char of "hello") {
      const result = applySearchKey(state, key(char));
      expect(result.kind).toBe("update");
      if (result.kind === "update") state = result.state;
    }

    const submit = applySearchKey(state, key("return"));
    expect(submit).toEqual({
      kind: "submit",
      state: {
        promptActive: false,
        value: "hello",
        cursor: 5,
        query: "hello",
        matchIndex: 0,
      },
    });

    const next = applySearchKey(submit.state, key("n"));
    expect(next).toEqual({ kind: "navigate", state: submit.state, direction: "next" });

    const previous = applySearchKey(submit.state, key("n", { shift: true }));
    expect(previous).toEqual({
      kind: "navigate",
      state: submit.state,
      direction: "previous",
    });
  });

  test("wraps match navigation", () => {
    expect(stepSearchMatchIndex(1, 2, "next")).toBe(0);
    expect(stepSearchMatchIndex(0, 2, "previous")).toBe(1);
  });

  test("formats breadcrumb prompt and status", () => {
    expect(formatSearchPromptBreadcrumb("term", 20)).toBe("Search: term_");
    expect(formatSearchStatus("term", 0, 3, 40)).toBe(" | 🔍 1/3");
    expect(formatSearchStatus("term", 0, 0, 40)).toBe(' | 🔍 "term" not found');
  });
});
