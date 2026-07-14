import { resolve } from "node:path";

import { isRemoteUrl } from "./resolve";

export const REMOTE_FETCH_TIMEOUT_MS = 30_000;
export const REMOTE_FETCH_MAX_BYTES = 2 * 1024 * 1024;
export const REMOTE_FETCH_MAX_REDIRECTS = 10;

export interface RemoteFetchLimits {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

async function readResponseText(
  response: Response,
  url: string,
  maxBytes: number,
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const size = Number(contentLength);
    if (!Number.isNaN(size) && size > maxBytes) {
      throw new Error(
        `Response from ${url} exceeds size limit (${size} bytes > ${maxBytes} bytes)`,
      );
    }
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response from ${url} exceeds size limit (${maxBytes} bytes)`);
    }

    chunks.push(value);
  }

  if (chunks.length === 0) return "";
  if (chunks.length === 1) return new TextDecoder().decode(chunks[0]!);

  return new TextDecoder().decode(concatChunks(chunks));
}

async function fetchRemoteResponse(
  url: string,
  limits: RemoteFetchLimits,
): Promise<Response> {
  const timeoutMs = limits.timeoutMs ?? REMOTE_FETCH_TIMEOUT_MS;
  const maxRedirects = limits.maxRedirects ?? REMOTE_FETCH_MAX_REDIRECTS;
  let currentUrl = url;
  let redirects = 0;

  while (true) {
    const response = await fetch(currentUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirects >= maxRedirects) {
        throw new Error(`Too many redirects while fetching ${url}`);
      }

      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect response from ${currentUrl} missing Location header`);
      }

      currentUrl = new URL(location, currentUrl).href;
      redirects += 1;
      continue;
    }

    return response;
  }
}

/** Read text from a remote URL. */
export async function loadTextFromUrl(
  url: string,
  limits: RemoteFetchLimits = {},
): Promise<string> {
  const maxBytes = limits.maxBytes ?? REMOTE_FETCH_MAX_BYTES;
  const response = await fetchRemoteResponse(url, limits);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return readResponseText(response, url, maxBytes);
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
export async function loadText(source: string, limits: RemoteFetchLimits = {}): Promise<string> {
  if (isRemoteUrl(source)) {
    return loadTextFromUrl(source, limits);
  }

  return loadTextFromFile(source);
}

/** Read HTML from a local file path or remote URL. */
export async function loadHtml(source: string, limits: RemoteFetchLimits = {}): Promise<string> {
  return loadText(source, limits);
}

/** Read HTML from a local file path. */
export async function loadHtmlFromFile(path: string): Promise<string> {
  return loadTextFromFile(path);
}
