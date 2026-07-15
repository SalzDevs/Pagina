import { describe, expect, test } from "bun:test";

import {
  REMOTE_FETCH_MAX_BYTES,
  REMOTE_FETCH_MAX_REDIRECTS,
  REMOTE_FETCH_TIMEOUT_MS,
} from "../navigation/load";
import { formatRuntimeLimitsHelpSection } from "../viewport/runtime-limits";

describe("formatRuntimeLimitsHelpSection", () => {
  test("derives limits from runtime constants", () => {
    const text = formatRuntimeLimitsHelpSection(80).join("\n");

    expect(text).toContain("Limits & behavior");
    expect(text).toContain(`${REMOTE_FETCH_TIMEOUT_MS / 1000} s timeout`);
    expect(text).toContain(`${REMOTE_FETCH_MAX_BYTES / (1024 * 1024)} MB max response`);
    expect(text).toContain(`${REMOTE_FETCH_MAX_REDIRECTS} redirects max`);
  });

  test("truncates long lines to the terminal width", () => {
    const lines = formatRuntimeLimitsHelpSection(24);
    expect(lines.every((line) => line.length <= 24)).toBe(true);
  });
});
