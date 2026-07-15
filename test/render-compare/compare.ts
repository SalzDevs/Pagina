import type { PageReference } from "./reference";
import type { PaginaRender } from "./pagina";

export type ComparisonSeverity = "ok" | "info" | "warning" | "error";

export interface ComparisonIssue {
  severity: ComparisonSeverity;
  category: "content" | "links" | "structure" | "styling" | "css" | "layout";
  message: string;
}

export interface PageComparison {
  pagePath: string;
  wordCoverage: number;
  issues: ComparisonIssue[];
}

/** Collapse terminal spacing for semantic text comparisons. */
export function collapseComparableText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function missingWords(reference: string[], actual: string[]): string[] {
  const actualSet = new Set(actual);
  return unique(reference).filter((word) => !actualSet.has(word));
}

function extraWords(reference: string[], actual: string[]): string[] {
  const referenceSet = new Set(reference);
  return unique(actual).filter((word) => !referenceSet.has(word));
}

function normalizeHref(href: string): string {
  return href.trim().replace(/^\.\//, "");
}

function compareLinks(reference: PageReference, pagina: PaginaRender): ComparisonIssue[] {
  const issues: ComparisonIssue[] = [];

  if (reference.links.length !== pagina.links.length) {
    issues.push({
      severity: "warning",
      category: "links",
      message: `Link count differs (reference ${reference.links.length}, pagina ${pagina.links.length})`,
    });
  }

  for (const refLink of reference.links) {
    const match = pagina.links.find(
      (link) =>
        normalizeHref(link.href) === normalizeHref(refLink.href) &&
        link.text.toLowerCase().includes(refLink.text.toLowerCase().slice(0, 8)),
    );

    if (!match) {
      issues.push({
        severity: "error",
        category: "links",
        message: `Missing or mismatched link: "${refLink.text}" → ${refLink.href}`,
      });
      continue;
    }

    if (!match.text.toLowerCase().includes(refLink.text.toLowerCase())) {
      issues.push({
        severity: "warning",
        category: "links",
        message: `Link text differs for ${refLink.href}: expected "${refLink.text}", got "${match.text}"`,
      });
    }
  }

  return issues;
}

function compareStructure(reference: PageReference, pagina: PaginaRender): ComparisonIssue[] {
  const issues: ComparisonIssue[] = [];

  const collapsed = collapseComparableText(pagina.plainText);

  for (const heading of reference.headings) {
    const found = collapsed.includes(collapseComparableText(heading.text));
    if (!found) {
      issues.push({
        severity: "error",
        category: "structure",
        message: `Missing heading: ${heading.text}`,
      });
    }
  }

  if (reference.listItems.length > 0) {
    const missingItems = reference.listItems.filter(
      (item) => !collapsed.includes(collapseComparableText(item)),
    );
    if (missingItems.length > 0) {
      issues.push({
        severity: "warning",
        category: "structure",
        message: `List items not found in render: ${missingItems.slice(0, 3).join(", ")}`,
      });
    }
  }

  if (reference.tableCells.length > 0) {
    const missingCells = reference.tableCells.filter(
      (cell) => !collapsed.includes(collapseComparableText(cell)),
    );
    if (missingCells.length > 0) {
      issues.push({
        severity: "warning",
        category: "structure",
        message: `Table cells not found in render: ${missingCells.join(", ")}`,
      });
    }
  }

  for (const image of reference.images) {
    if (image.alt) {
      const altPattern = new RegExp(
        `\\[alt:\\s*${image.alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\s*\\]`,
        "i",
      );
      if (!altPattern.test(pagina.plainText)) {
        issues.push({
          severity: "error",
          category: "structure",
          message: `Missing image alt placeholder: [alt: ${image.alt}]`,
        });
      }
    } else if (!pagina.plainText.includes("[image]")) {
      issues.push({
        severity: "info",
        category: "structure",
        message: "Decorative image without alt may be omitted in browser but Pagina should show [image]",
      });
    }
  }

  return issues;
}

function compareStyling(reference: PageReference, pagina: PaginaRender, pagePath: string): ComparisonIssue[] {
  const issues: ComparisonIssue[] = [];

  if (/styled-page|linked-page|responsive-page|theme\.css/.test(pagePath) || pagePath.endsWith("linked-page.html")) {
    if (pagina.styleSamples.length === 0) {
      issues.push({
        severity: "warning",
        category: "styling",
        message: "Expected styled page to emit colored or weighted text commands",
      });
    }
  }

  if (pagePath.endsWith("responsive-page.html")) {
    const collapsed = collapseComparableText(pagina.plainText);
    const hasWide = collapsed.includes("wide viewport");
    const hasNarrow = collapsed.includes("narrow viewport");
    if (!hasWide && !hasNarrow) {
      issues.push({
        severity: "error",
        category: "styling",
        message: "Responsive @media content missing at this viewport width",
      });
    }
  }

  if (reference.title && pagina.pageTitle && reference.title !== pagina.pageTitle) {
    issues.push({
      severity: "info",
      category: "content",
      message: `Title differs (reference "${reference.title}", pagina "${pagina.pageTitle}")`,
    });
  }

  return issues;
}

/** Compare a semantic HTML reference against Pagina's rendered output. */
export function comparePageRender(
  reference: PageReference,
  pagina: PaginaRender,
): PageComparison {
  const issues: ComparisonIssue[] = [];
  const missing = missingWords(reference.words, pagina.words);
  const extra = extraWords(reference.words, pagina.words);

  const wordCoverage =
    reference.words.length === 0
      ? 1
      : (reference.words.length - missing.length) / reference.words.length;

  if (missing.length > 0) {
    issues.push({
      severity: missing.length > reference.words.length * 0.1 ? "error" : "warning",
      category: "content",
      message: `Missing words (${missing.length}): ${missing.slice(0, 12).join(", ")}`,
    });
  }

  if (extra.length > 0) {
    issues.push({
      severity: "info",
      category: "content",
      message: `Extra terminal-only words (${extra.length}): ${extra.slice(0, 12).join(", ")}`,
    });
  }

  if (pagina.cssWarnings.length > 0) {
    issues.push({
      severity: "warning",
      category: "css",
      message: `Stylesheet warnings: ${pagina.cssWarnings.join(", ")}`,
    });
  }

  issues.push(...compareLinks(reference, pagina));
  issues.push(...compareStructure(reference, pagina));
  issues.push(...compareStyling(reference, pagina, reference.pagePath));

  if (pagina.contentHeight <= 1 && reference.words.length > 5) {
    issues.push({
      severity: "error",
      category: "layout",
      message: "Rendered page height is unexpectedly small",
    });
  }

  return {
    pagePath: reference.pagePath,
    wordCoverage,
    issues,
  };
}

export function formatComparisonReport(comparisons: PageComparison[]): string {
  const lines: string[] = [
    "# Pagina render comparison report",
    "",
    "Compares semantic HTML reference text against Pagina terminal output at 80×24.",
    "",
  ];

  for (const comparison of comparisons) {
    const pageName = comparison.pagePath.split("/").slice(-2).join("/");
    const errors = comparison.issues.filter((issue) => issue.severity === "error");
    const warnings = comparison.issues.filter((issue) => issue.severity === "warning");

    lines.push(`## ${pageName}`);
    lines.push(`- Word coverage: ${(comparison.wordCoverage * 100).toFixed(1)}%`);
    lines.push(`- Issues: ${errors.length} errors, ${warnings.length} warnings`);

    if (comparison.issues.length === 0) {
      lines.push("- Status: OK");
    } else {
      for (const issue of comparison.issues) {
        lines.push(`- [${issue.severity}/${issue.category}] ${issue.message}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
