import { describe, expect, test } from "bun:test";

import { formatHelpLines, formatKeybindingLine, PAGINA_KEYBINDINGS } from "../viewport/keybindings";
import { isHelpToggleKey } from "../viewport/help-key";

function key(name: string) {
  return {
    name,
    eventType: "press" as const,
    ctrl: false,
    meta: false,
    shift: false,
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

describe("keybindings", () => {
  test("lists every major interaction", () => {
    const joined = PAGINA_KEYBINDINGS.map((entry) => entry.description).join(" ");
    expect(joined).toContain("Scroll");
    expect(joined).toContain("link");
    expect(joined).toContain("Back");
    expect(joined).toContain("help");
  });

  test("formats help lines within terminal width", () => {
    const lines = formatHelpLines(60);
    expect(lines[0]).toContain("Pagina");
    expect(lines.at(-1)).toBe("Press ? to close");
    expect(lines.every((line) => line.length <= 60)).toBe(true);
  });

  test("truncates long binding lines on narrow terminals", () => {
    const line = formatKeybindingLine(
      { keys: "Option+← / →", description: "Back / forward (macOS)" },
      20,
    );
    expect(line.length).toBeLessThanOrEqual(20);
  });
});

describe("help key", () => {
  test("matches ?", () => {
    expect(isHelpToggleKey(key("?"))).toBe(true);
    expect(isHelpToggleKey(key("/"))).toBe(false);
  });
});
