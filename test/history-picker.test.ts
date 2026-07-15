import { describe, expect, test } from "bun:test";

import {
  createBrowserHistory,
  goToHistoryIndex,
  historyTargetAtBreadcrumbColumn,
  layoutBreadcrumb,
  pushHistory,
} from "../navigation/history";
import {
  activateHistoryPicker,
  applyHistoryPickerKey,
  createHistoryPickerState,
  formatHistoryPickerLines,
  isHistoryPickerToggleKey,
} from "../viewport/history-picker";

function key(
  name: string,
  options: { shift?: boolean; ctrl?: boolean } = {},
) {
  return {
    name,
    eventType: "press" as const,
    ctrl: options.ctrl ?? false,
    meta: false,
    shift: options.shift ?? false,
    option: false,
    sequence: name,
    number: false,
    raw: "",
    source: "raw" as const,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {},
    stopPropagation() {},
  };
}

describe("breadcrumb layout", () => {
  test("records segment ranges for visible entries", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });
    history = pushHistory(history, { location: "/b", label: "Other" });

    const layout = layoutBreadcrumb(history, 40);
    expect(layout.text).toBe("Home › [Other]");
    expect(layout.segments).toEqual([
      { index: 0, label: "Home", start: 0, end: 4 },
      { index: 1, label: "[Other]", start: 7, end: 14 },
    ]);
  });

  test("maps ellipsis clicks to the history picker", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "First Page" });
    history = pushHistory(history, { location: "/b", label: "Second Page" });
    history = pushHistory(history, { location: "/c", label: "Current Page" });

    const layout = layoutBreadcrumb(history, 24);
    expect(layout.ellipsis).toEqual({ start: 0, end: 3 });
    expect(historyTargetAtBreadcrumbColumn(layout, 1)).toBe("picker");
    expect(historyTargetAtBreadcrumbColumn(layout, layout.text.indexOf("Current"))).toBe(2);
  });

  test("jumps to a specific history index", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "A" });
    history = pushHistory(history, { location: "/b", label: "B" });
    history = pushHistory(history, { location: "/c", label: "C" });

    const result = goToHistoryIndex(history, 0);
    expect(result.history.index).toBe(0);
    expect(result.entry?.label).toBe("A");
  });
});

describe("history picker", () => {
  test("opens on b", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });

    expect(isHistoryPickerToggleKey(key("b"))).toBe(true);
    expect(isHistoryPickerToggleKey(key("B", { shift: true }))).toBe(false);

    const result = applyHistoryPickerKey(createHistoryPickerState(), key("b"), history);
    expect(result).toEqual({ kind: "open", state: activateHistoryPicker(history) });
  });

  test("moves selection and submits an entry", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });
    history = pushHistory(history, { location: "/b", label: "Other" });

    let state = activateHistoryPicker(history);
    const moved = applyHistoryPickerKey(state, key("up"), history);
    expect(moved.kind).toBe("update");
    if (moved.kind === "update") state = moved.state;

    expect(state.selectedIndex).toBe(0);

    const submit = applyHistoryPickerKey(state, key("return"), history);
    expect(submit).toEqual({ kind: "submit", index: 0 });
  });

  test("formats picker lines with the current entry marked", () => {
    let history = createBrowserHistory();
    history = pushHistory(history, { location: "/a", label: "Home" });
    history = pushHistory(history, { location: "/b", label: "Other" });

    const lines = formatHistoryPickerLines(history, 40, 0);
    expect(lines.join("\n")).toContain("› Home");
    expect(lines.join("\n")).toContain("Other (current)");
  });
});
