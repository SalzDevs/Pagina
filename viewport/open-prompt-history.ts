/** Recent locations entered through the open prompt. */
export class OpenPromptHistory {
  private readonly entries: string[];
  private readonly maxEntries: number;
  private readonly onChange?: (entries: readonly string[]) => void;

  constructor(
    options: {
      maxEntries?: number;
      initial?: readonly string[];
      onChange?: (entries: readonly string[]) => void;
    } = {},
  ) {
    this.maxEntries = options.maxEntries ?? 50;
    this.entries = [...(options.initial ?? [])];
    this.onChange = options.onChange;
  }

  get length(): number {
    return this.entries.length;
  }

  get(index: number): string | undefined {
    return this.entries[index];
  }

  toArray(): readonly string[] {
    return [...this.entries];
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

    this.onChange?.(this.entries);
  }
}
