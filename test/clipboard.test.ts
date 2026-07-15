import { afterEach, describe, expect, test } from "bun:test";

import { copyToClipboard, setClipboardWriter } from "../navigation/clipboard";

afterEach(() => {
  setClipboardWriter(null);
});

describe("copyToClipboard", () => {
  test("uses a test override when installed", async () => {
    const copied: string[] = [];
    setClipboardWriter(async (text) => {
      copied.push(text);
      return true;
    });

    expect(await copyToClipboard("https://example.com/page.html")).toBe(true);
    expect(copied).toEqual(["https://example.com/page.html"]);
  });

  test("reports failure when the override rejects the write", async () => {
    setClipboardWriter(async () => false);

    expect(await copyToClipboard("https://example.com/page.html")).toBe(false);
  });
});
