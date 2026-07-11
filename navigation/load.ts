import { resolve } from "node:path";

/** Read text from a local file path. */
export async function loadTextFromFile(path: string): Promise<string> {
  const filePath = resolve(path);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  return file.text();
}

/** Read HTML from a local file path. */
export async function loadHtmlFromFile(path: string): Promise<string> {
  return loadTextFromFile(path);
}
