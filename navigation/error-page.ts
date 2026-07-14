import { basename, relative, resolve } from "node:path";

import { isRemoteUrl } from "./resolve";

const DEFAULT_HOME = "examples/page.html";

export const ERROR_PAGE_TITLE = "Could not load page";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format an unknown thrown value for display on the error page. */
export function formatLoadError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Shorten a local filesystem path for display in the error page. */
export function formatErrorPageLocation(location: string): string {
  if (isRemoteUrl(location)) return location;

  const absolute = resolve(location);
  const fromCwd = relative(process.cwd(), absolute);

  if (fromCwd && !fromCwd.startsWith("..")) {
    return fromCwd;
  }

  return basename(absolute) || absolute;
}

/** Format load errors for display, shortening embedded filesystem paths. */
export function formatLoadErrorForDisplay(error: unknown): string {
  const message = formatLoadError(error);
  const fileNotFound = /^File not found: (.+)$/.exec(message);

  if (fileNotFound) {
    return `File not found: ${formatErrorPageLocation(fileNotFound[1]!)}`;
  }

  return message;
}

/** Build HTML for a browser-style error page when navigation fails. */
export function buildErrorPageHtml(failedLocation: string, error: unknown): string {
  const url = escapeHtml(formatErrorPageLocation(failedLocation));
  const message = escapeHtml(formatLoadErrorForDisplay(error));
  const home = escapeHtml(DEFAULT_HOME);
  const retry = escapeHtml(failedLocation);

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${ERROR_PAGE_TITLE}</title>
    <style>
      body { color: #cccccc; background: #111111; }
      h1 { color: #f48771; }
      code { color: #ce9178; }
      a { color: #569cd6; }
      p { margin: 0 0 1em 0; }
    </style>
  </head>
  <body>
    <h1>Could not load page</h1>
    <p>Pagina could not load the requested page.</p>
    <p><strong>URL:</strong> <code>${url}</code></p>
    <p><strong>Error:</strong> ${message}</p>
    <p>
      Press <strong>u</strong> to go back, or follow a link below.
    </p>
    <p>
      <a href="${retry}">Try again</a>
      ·
      <a href="${home}">Go to home page</a>
    </p>
  </body>
</html>
`;
}

export const ERROR_PAGE_HOME = DEFAULT_HOME;
