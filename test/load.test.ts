import { describe, expect, test } from "bun:test";

import { loadHtmlFromFile } from "../navigation/load";

describe("loadHtmlFromFile", () => {
  test("reads html from a file path", async () => {
    const html = await loadHtmlFromFile("examples/page.html");

    expect(html).toContain("<html>");
    expect(html).toContain("<strong>Pagina</strong>");
  });

  test("throws when the file does not exist", async () => {
    await expect(loadHtmlFromFile("examples/missing.html")).rejects.toThrow("File not found");
  });
});
