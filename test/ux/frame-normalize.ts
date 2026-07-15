/** Strip volatile breadcrumb regions before golden frame comparison. */
export function normalizeFrame(frame: string): string {
  const lines = frame.split("\n");
  if (lines.length === 0) {
    return frame;
  }

  // Scroll position hints (e.g. " | 1/35") change when content height shifts.
  lines[0] = lines[0].replace(/\s*\|\s*\d+\/\d+/, "");

  return lines.join("\n");
}
