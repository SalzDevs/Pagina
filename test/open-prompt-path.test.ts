import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { completeLocalPath, expandTilde, pathTokenAtCursor } from "../viewport/open-prompt-path";

describe("expandTilde", () => {
  test("expands home directory shorthand", () => {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    if (home.length === 0) return;

    expect(expandTilde("~")).toBe(home);
    expect(expandTilde("~/notes")).toBe(resolve(home, "notes"));
  });
});

describe("pathTokenAtCursor", () => {
  test("returns the path token ending at the cursor", () => {
    expect(pathTokenAtCursor("open examples/pa", 16)).toEqual({
      tokenStart: 5,
      token: "examples/pa",
    });
  });
});

describe("completeLocalPath", () => {
  test("completes a relative file path", () => {
    const result = completeLocalPath("examples/pa", 11, process.cwd());
    expect(result).toEqual({
      value: "examples/page.html",
      cursor: "examples/page.html".length,
    });
  });

  test("completes a directory name inside examples", () => {
    const result = completeLocalPath("examples/n", 10, process.cwd());
    expect(result).toEqual({
      value: "examples/nested/",
      cursor: "examples/nested/".length,
    });
  });

  test("ignores remote URLs", () => {
    expect(completeLocalPath("https://example.com/pa", 22, process.cwd())).toBeNull();
  });
});
