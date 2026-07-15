import { describe, expect, test } from "bun:test";

import { comparePageRender, formatComparisonReport } from "./compare";
import {
  COMPARISON_VIEWPORTS,
  DEFAULT_VIEWPORT,
  EXAMPLE_PAGES,
  MEDIUM_VIEWPORT,
} from "./fixtures";
import { buildPaginaRender } from "./pagina";
import { buildPageReference } from "./reference";
import { layout } from "../../layout/layout";
import { loadPageContent } from "../../navigation/load-page";
import { buildPageView } from "../../viewport/page-view";
import { isTextCommand } from "../../paint/display-list";
import { convert } from "../../parser/convert";
import { parseHTML } from "../../parser/html";
import { computeStyles } from "../../style/style";
import { BLOCKQUOTE_INDENT } from "../../style/style";
import { DEFINITION_INDENT } from "../../layout/definitions";

const comparisons = await Promise.all(
  COMPARISON_VIEWPORTS.flatMap(({ viewport }) =>
    EXAMPLE_PAGES.map(async (pagePath) => {
      const reference = await buildPageReference(pagePath);
      const pagina = await buildPaginaRender(pagePath, viewport);
      return comparePageRender(reference, pagina, viewport);
    }),
  ),
);

const report = formatComparisonReport(comparisons);

describe("render comparison — example pages", () => {
  test("prints a comparison report for all example pages", () => {
    console.log("\n" + report + "\n");
    expect(report).toContain("Pagina render comparison report");
    expect(report).toContain("Viewport matrix");
    expect(report).toContain("30x24");
    expect(report).toContain("40x24");
    expect(report).toContain("60x24");
    expect(report).toContain("80x24");
    expect(comparisons.length).toBe(EXAMPLE_PAGES.length * COMPARISON_VIEWPORTS.length);
  });

  for (const comparison of comparisons) {
    const pageName = comparison.pagePath.split("/").slice(-2).join("/");
    const viewportLabel = `${comparison.viewportWidth}x${comparison.viewportHeight}`;

    test(`${pageName} @ ${viewportLabel} preserves most reference words`, () => {
      expect(comparison.wordCoverage).toBeGreaterThanOrEqual(0.85);
    });

    test(`${pageName} @ ${viewportLabel} has no critical render errors`, () => {
      const errors = comparison.issues.filter((issue) => issue.severity === "error");
      expect(errors).toEqual([]);
    });
  }
});

describe("render comparison — responsive behavior", () => {
  for (const { viewport, label } of COMPARISON_VIEWPORTS) {
    test(`responsive-page.html matches @media rules at ${label}`, async () => {
      const pagina = await buildPaginaRender("examples/responsive-page.html", viewport);
      const collapsed = pagina.plainText.replace(/\s+/g, " ");

      if (viewport.width <= MEDIUM_VIEWPORT.width) {
        expect(collapsed).toContain("Narrow viewport");
        expect(collapsed).not.toContain("Wide viewport");
        return;
      }

      expect(collapsed).toContain("Wide viewport");
      expect(collapsed).not.toContain("Narrow viewport");
    });
  }
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

describe("render comparison — table structure", () => {
  test("aligns table-page.html columns at 80 columns", async () => {
    const page = await loadPageContent("examples/table-page.html", { viewportWidth: DEFAULT_VIEWPORT.width });
    const laidOut = layout(page.styled, { viewport: DEFAULT_VIEWPORT });
    const body = page.styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const table = body?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "table",
    );

    const fragments: Array<{ x: number; text: string }> = [];
    const walk = (node: typeof table) => {
      if (!node) return;
      for (const fragment of laidOut.output.getFragments(node)) {
        fragments.push({ x: fragment.x, text: fragment.text.trim() });
      }
      for (const child of node.children) walk(child as typeof table);
    };
    walk(table);

    const nameX = fragments.find((fragment) => fragment.text === "Name")?.x;
    const alphaX = fragments.find((fragment) => fragment.text === "Alpha")?.x;
    const valueX = fragments.find((fragment) => fragment.text === "Value")?.x;
    const oneX = fragments.find((fragment) => fragment.text === "1")?.x;

    expect(nameX).toBe(alphaX);
    expect(valueX).toBe(oneX);
    expect(valueX).toBeGreaterThan(nameX!);
  });

  test("includes table header rule on table-page.html", async () => {
    const pagina = await buildPaginaRender("examples/table-page.html", DEFAULT_VIEWPORT);
    expect(pagina.plainText).toMatch(/Name\s+Value/);
    expect(pagina.plainText).toMatch(/─{3,}/);
    expect(pagina.plainText).toMatch(/Alpha\s+1/);
  });
});

describe("render comparison — blockquote structure", () => {
  test("indents nested blockquotes on blockquote-page.html", async () => {
    const page = await loadPageContent("examples/blockquote-page.html", {
      viewportWidth: DEFAULT_VIEWPORT.width,
    });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const commands = view.displayList.filter(isTextCommand);

    const bodyX = commands.find((command) => command.text.includes("Body text sits"))?.x;
    const singleQuoteX = commands.find((command) =>
      command.text.includes("This quotation is indented"),
    )?.x;
    const outerQuoteX = commands.find((command) => command.text.includes("Outer quote"))?.x;
    const nestedQuoteX = commands.find((command) =>
      command.text.includes("Nested quote indents further"),
    )?.x;

    expect(bodyX).toBe(0);
    expect(singleQuoteX).toBe(BLOCKQUOTE_INDENT);
    expect(outerQuoteX).toBe(BLOCKQUOTE_INDENT);
    expect(nestedQuoteX).toBe(BLOCKQUOTE_INDENT * 2);
    expect(nestedQuoteX).toBeGreaterThan(outerQuoteX!);
  });

  test("preserves blockquote indentation in plain text extraction", async () => {
    const pagina = await buildPaginaRender("examples/blockquote-page.html", DEFAULT_VIEWPORT);
    const lines = pagina.plainText.split("\n");

    const bodyLine = lines.find((line) => line.includes("Body text sits"));
    const nestedLine = lines.find((line) => line.includes("Nested quote indents further"));

    expect(bodyLine?.startsWith("Body text")).toBe(true);
    expect((nestedLine?.match(/^ */)?.[0].length ?? 0)).toBeGreaterThanOrEqual(BLOCKQUOTE_INDENT * 2);
  });
});

describe("render comparison — definition list structure", () => {
  test("indents descriptions on definitions-page.html", async () => {
    const page = await loadPageContent("examples/definitions-page.html", {
      viewportWidth: DEFAULT_VIEWPORT.width,
    });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const commands = view.displayList.filter(isTextCommand);

    const term = commands.find((command) => command.text.trim() === "Term");
    const definitionOne = commands.find((command) =>
      command.text.includes("Definition one with enough words"),
    );
    const definitionTwo = commands.find((command) => command.text.trim() === "Definition two");
    const anotherTerm = commands.find((command) => command.text.trim() === "Another term");

    expect(term?.x).toBe(0);
    expect(definitionOne?.x).toBe(DEFINITION_INDENT);
    expect(definitionTwo?.x).toBe(DEFINITION_INDENT);
    expect(anotherTerm?.x).toBe(0);
    expect(term!.y).toBeLessThan(definitionOne!.y);
    expect(definitionOne!.y).toBeLessThan(definitionTwo!.y);
    expect(definitionTwo!.y).toBeLessThan(anotherTerm!.y);
  });

  test("preserves definition list indentation in plain text extraction", async () => {
    const pagina = await buildPaginaRender("examples/definitions-page.html", DEFAULT_VIEWPORT);
    const lines = pagina.plainText.split("\n");

    const termLine = lines.find((line) => line.trim() === "Term");
    const definitionLine = lines.find((line) => line.includes("Definition one"));

    expect((termLine?.match(/^ */)?.[0].length ?? 0)).toBe(0);
    expect((definitionLine?.match(/^ */)?.[0].length ?? 0)).toBeGreaterThanOrEqual(
      DEFINITION_INDENT,
    );
  });
});

describe("render comparison — preformatted structure", () => {
  test("preserves pre and pre-wrap whitespace on pre-page.html", async () => {
    const page = await loadPageContent("examples/pre-page.html", {
      viewportWidth: DEFAULT_VIEWPORT.width,
    });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const commands = view.displayList.filter(isTextCommand);

    const preWrapFirst = commands.find((command) => command.text === "  indented line");
    const preWrapSecond = commands.find((command) => command.text === "second line");
    const codeLine = commands.find((command) => command.text.includes("function greet(name)"));
    const returnLine = commands.find((command) => command.text.includes('return "hello "'));
    const asciiLine = commands.find((command) => command.text.trim() === "*");

    expect(preWrapFirst?.x).toBe(0);
    expect(preWrapSecond?.x).toBe(0);
    expect(preWrapFirst!.y).toBeLessThan(preWrapSecond!.y);
    expect(codeLine).toBeDefined();
    expect(returnLine?.text.startsWith("  return")).toBe(true);
    expect(asciiLine).toBeDefined();
    expect(codeLine!.y).toBeLessThan(asciiLine!.y);
  });

  test("keeps long pre lines unwrapped while pre-wrap splits in the display list", async () => {
    const line = "y".repeat(24);
    const viewport = { width: 10, height: 10 };

    const preStyled = await computeStyles(
      convert(parseHTML(`<html><body><pre>${line}</pre></body></html>`)),
    );
    const wrapStyled = await computeStyles(
      convert(parseHTML(`<html><body><pre style="white-space: pre-wrap">${line}</pre></body></html>`)),
    );

    const preCommands = buildPageView(preStyled, viewport).displayList.filter(isTextCommand);
    const wrapCommands = buildPageView(wrapStyled, viewport).displayList.filter(isTextCommand);

    expect(preCommands).toHaveLength(1);
    expect(preCommands[0]?.text).toHaveLength(24);
    expect(wrapCommands.length).toBeGreaterThan(1);
  });
});

describe("render comparison — heading hierarchy", () => {
  test("renders distinct heading sizes on long-page.html", async () => {
    const page = await loadPageContent("examples/long-page.html", { viewportWidth: DEFAULT_VIEWPORT.width });
    const styled = page.styled;
    const laidOut = layout(styled, { viewport: DEFAULT_VIEWPORT });

    const body = styled.children[0]?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "body",
    );
    const h1 = body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "h1");
    const h2 = body?.children.find((child) => child.dom.type === "element" && child.dom.tag === "h2");
    const h1Text = h1?.children.find((child) => child.dom.type === "text");
    const h2Text = h2?.children.find((child) => child.dom.type === "text");

    const h1Height = laidOut.output.getFragments(h1Text!)[0]?.height ?? 0;
    const h2Height = laidOut.output.getFragments(h2Text!)[0]?.height ?? 0;

    expect(h1Height).toBeGreaterThan(h2Height);
  });
});

describe("render comparison — inline spacing", () => {
  test("keeps single spaces in inline paragraphs on images-page.html", async () => {
    const page = await loadPageContent("examples/images-page.html", { viewportWidth: DEFAULT_VIEWPORT.width });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);

    expect(
      view.displayList
        .filter(isTextCommand)
        .filter((command) => command.text === "[alt: sales chart]"),
    ).toHaveLength(1);
  });

  test("does not pad words when joining display-list text for comparison", async () => {
    const pagina = await buildPaginaRender("examples/images-page.html", DEFAULT_VIEWPORT);
    const inlineLine = pagina.plainText
      .split("\n")
      .find((line) => line.includes("[alt: sales chart]"));

    expect(inlineLine).toBe("See the [alt: sales chart] for quarterly results.");
  });
});

describe("render comparison — list structure", () => {
  test("indents nested list items on lists-page.html", async () => {
    const page = await loadPageContent("examples/lists-page.html", { viewportWidth: DEFAULT_VIEWPORT.width });
    const view = buildPageView(page.styled, DEFAULT_VIEWPORT);
    const markers = view.displayList
      .filter(isTextCommand)
      .filter((command) => command.text === "- ");

    const outerMarkers = markers.filter((command) => command.x === 0);
    const nestedMarkers = markers.filter((command) => command.x >= 2);

    expect(outerMarkers.length).toBeGreaterThan(0);
    expect(nestedMarkers.length).toBeGreaterThan(0);
    expect(Math.min(...nestedMarkers.map((command) => command.x))).toBeGreaterThan(0);
  });

  test("preserves nested list indentation in plain text extraction", async () => {
    const pagina = await buildPaginaRender("examples/lists-page.html", DEFAULT_VIEWPORT);
    const innerLine = pagina.plainText.split("\n").find((line) => line.includes("Inner A"));
    const outerLine = pagina.plainText.split("\n").find((line) => line.includes("Outer one"));

    expect(innerLine).toBeDefined();
    expect(outerLine).toBeDefined();
    expect((innerLine?.match(/^ */)?.[0].length ?? 0)).toBeGreaterThan(
      outerLine?.match(/^ */)?.[0].length ?? 0,
    );
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
