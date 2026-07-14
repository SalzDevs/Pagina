/** Recent locations entered through the open prompt. */
export class OpenPromptHistory {
  private readonly entries: string[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  get length(): number {
    return this.entries.length;
  }

  get(index: number): string | undefined {
    return this.entries[index];
  }

  /** Append a submitted location, skipping empty values and consecutive duplicates. */
  add(entry: string): void {
    const trimmed = entry.trim();
    if (trimmed.length === 0) return;
    if (this.entries[this.entries.length - 1] === trimmed) return;

    this.entries.push(trimmed);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }
}
