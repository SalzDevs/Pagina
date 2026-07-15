/**
 * Optional Playwright baseline: compare Chrome document.body.innerText
 * against Pagina terminal output for representative pages.
 *
 * Requires Chromium once:
 *   bunx playwright install chromium
 *
 * Run:
 *   bun run test:browser-baseline
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

import { DEFAULT_VIEWPORT } from "../render-compare/fixtures";
import { buildPaginaRender } from "../render-compare/pagina";
import {
  BASELINE_PAGES,
  formatWordDiff,
  normalizeComparableWords,
  wordCoverage,
} from "./compare";

describe("browser text baseline", () => {
  for (const pagePath of BASELINE_PAGES) {
    test(`${pagePath} matches Chrome innerText closely`, async () => {
      const absolutePath = resolve(pagePath);
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(absolutePath).href);
        const browserText = await page.evaluate(() => document.body?.innerText ?? "");
        const pagina = await buildPaginaRender(pagePath, DEFAULT_VIEWPORT);

        const browserWords = normalizeComparableWords(browserText);
        const paginaWords = normalizeComparableWords(pagina.plainText);

        const paginaCapturesBrowser = wordCoverage(browserWords, paginaWords);
        const browserCapturesPagina = wordCoverage(paginaWords, browserWords);

        expect(
          paginaCapturesBrowser,
          formatWordDiff("Pagina vs Chrome", browserWords, paginaWords),
        ).toBeGreaterThanOrEqual(0.85);
        expect(
          browserCapturesPagina,
          formatWordDiff("Chrome vs Pagina", paginaWords, browserWords),
        ).toBeGreaterThanOrEqual(0.85);
      } finally {
        await browser.close();
      }
    });
  }
});
