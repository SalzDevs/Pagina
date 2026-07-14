import { describe, expect, test } from "bun:test";

import { resolveVarReferences } from "../style/css/variables";

describe("resolveVarReferences", () => {
  test("resolves a single custom property reference", () => {
    expect(
      resolveVarReferences("var(--text-primary)", {
        "--text-primary": "#cccccc",
      }),
    ).toBe("#cccccc");
  });

  test("uses fallback values when a token is missing", () => {
    expect(resolveVarReferences("var(--missing, #ff0000)", {})).toBe("#ff0000");
  });

  test("resolves nested custom property references", () => {
    expect(
      resolveVarReferences("var(--text-primary)", {
        "--text-primary": "var(--gray-100)",
        "--gray-100": "#eeeeee",
      }),
    ).toBe("#eeeeee");
  });
});
