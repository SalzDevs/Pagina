import { describe, expect, test } from "bun:test";

import { OpenPromptHistory } from "../viewport/open-prompt-history";

describe("OpenPromptHistory", () => {
  test("stores recent entries without consecutive duplicates", () => {
    const history = new OpenPromptHistory();

    history.add("examples/page.html");
    history.add("examples/page.html");
    history.add("examples/links-page.html");

    expect(history.length).toBe(2);
    expect(history.get(0)).toBe("examples/page.html");
    expect(history.get(1)).toBe("examples/links-page.html");
  });
});
