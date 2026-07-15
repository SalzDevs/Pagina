import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { comparePageRender } from "./compare";
import { buildPaginaRender } from "./pagina";
import { buildPageReference } from "./reference";
import { DEFAULT_VIEWPORT, REAL_WORLD_FIXTURES } from "./fixtures";

describe("render comparison — real-world fixtures", () => {
  test("documents fixture intent and known browser differences", () => {
    const readme = readFileSync("examples/fixtures/README.md", "utf8");
    expect(readme).toContain("blog-post.html");
    expect(readme).toContain("docs-page.html");
    expect(readme).toContain("readme-page.html");
    expect(readme).toContain("Known Pagina differences");
  });

  for (const pagePath of REAL_WORLD_FIXTURES) {
    const fixtureName = pagePath.split("/").at(-1)!;

    test(`${fixtureName} documents provenance in an HTML comment`, () => {
      const html = readFileSync(pagePath, "utf8");
      expect(html).toMatch(/Fixture:/);
      expect(html).toMatch(/Expected Pagina differences:/);
    });

    test(`${fixtureName} passes render comparison at 80x24`, async () => {
      const reference = await buildPageReference(pagePath);
      const pagina = await buildPaginaRender(pagePath, DEFAULT_VIEWPORT);
      const comparison = comparePageRender(reference, pagina, DEFAULT_VIEWPORT);

      expect(comparison.wordCoverage).toBeGreaterThanOrEqual(0.85);
      expect(comparison.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    });
  }
});
