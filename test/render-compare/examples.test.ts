import { describe, expect, test } from "bun:test";

import { comparePageRender, formatComparisonReport } from "./compare";
import { DEFAULT_VIEWPORT, EXAMPLE_PAGES, NARROW_VIEWPORT } from "./fixtures";
import { buildPaginaRender } from "./pagina";
import { buildPageReference } from "./reference";
import { buildPageReference } from "./reference";

const comparisons = await Promise.all(
  EXAMPLE_PAGES.map(async (pagePath) => {
    const reference = await buildPageReference(pagePath);
    const pagina = await buildPaginaRender(pagePath, DEFAULT_VIEWPORT);
    return comparePageRender(reference, pagina);
  }),
);

const report = formatComparisonReport(comparisons);

describe("render comparison — example pages", () => {
  test("prints a comparison report for all example pages", () => {
    console.log("\n" + report + "\n");
    expect(report).toContain("Pagina render comparison report");
    expect(comparisons.length).toBe(EXAMPLE_PAGES.length);
  });

  for (const comparison of comparisons) {
    const pageName = comparison.pagePath.split("/").slice(-2).join("/");

    test(`${pageName} preserves most reference words`, () => {
      expect(comparison.wordCoverage).toBeGreaterThanOrEqual(0.85);
    });

    test(`${pageName} has no critical render errors`, () => {
      const errors = comparison.issues.filter((issue) => issue.severity === "error");
      expect(errors).toEqual([]);
    });
  }
});

describe("render comparison — responsive behavior", () => {
  test("shows wide-only content at 80 columns", async () => {
    const pagina = await buildPaginaRender("examples/responsive-page.html", DEFAULT_VIEWPORT);
    const collapsed = pagina.plainText.replace(/\s+/g, " ");
    expect(collapsed).toContain("Wide viewport");
    expect(collapsed).not.toContain("Narrow viewport");
  });

  test("shows narrow-only content at 30 columns", async () => {
    const pagina = await buildPaginaRender("examples/responsive-page.html", NARROW_VIEWPORT);
    const collapsed = pagina.plainText.replace(/\s+/g, " ");
    expect(collapsed).toContain("Narrow viewport");
    expect(collapsed).not.toContain("Wide viewport");
  });
});

describe("render comparison — styling fidelity", () => {
  test("applies author colors on styled-page.html", async () => {
    const pagina = await buildPaginaRender("examples/styled-page.html", DEFAULT_VIEWPORT);
    expect(pagina.styleSamples.some((sample) => sample.fg === "#ffd700" && sample.bold)).toBe(true);
    expect(pagina.styleSamples.some((sample) => sample.fg === "#8be9fd")).toBe(true);
    expect(pagina.styleSamples.some((sample) => sample.fg === "#50fa7b" && sample.bold)).toBe(true);
  });

  test("applies linked stylesheet colors on linked-page.html", async () => {
    const pagina = await buildPaginaRender("examples/linked-page.html", DEFAULT_VIEWPORT);
    expect(pagina.cssWarnings).toEqual([]);
    expect(pagina.styleSamples.some((sample) => sample.fg === "#ffd700")).toBe(true);
    expect(pagina.styleSamples.some((sample) => sample.fg === "#8be9fd")).toBe(true);
  });
});

describe("render comparison — link fidelity", () => {
  test("preserves all links on links-page.html", async () => {
    const reference = await buildPageReference("examples/links-page.html");
    const pagina = await buildPaginaRender("examples/links-page.html", DEFAULT_VIEWPORT);
    expect(pagina.links).toEqual(reference.links);
  });
});

export { comparisons, report };
