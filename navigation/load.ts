import { resolve } from "node:path";

import { isRemoteUrl } from "./resolve";

/** Read text from a remote URL. */
export async function loadTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/** Read text from a local file path. */
export async function loadTextFromFile(path: string): Promise<string> {
  const filePath = resolve(path);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  return file.text();
}

/** Read text from a local file path or remote URL. */
export async function loadText(source: string): Promise<string> {
  if (isRemoteUrl(source)) {
    return loadTextFromUrl(source);
  }

  return loadTextFromFile(source);
}

/** Read HTML from a local file path or remote URL. */
export async function loadHtml(source: string): Promise<string> {
  return loadText(source);
}

/** Read HTML from a local file path. */
export async function loadHtmlFromFile(path: string): Promise<string> {
  return loadTextFromFile(path);
}
