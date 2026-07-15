export const REAL_WORLD_FIXTURES = [
  "examples/fixtures/blog-post.html",
  "examples/fixtures/docs-page.html",
  "examples/fixtures/readme-page.html",
] as const;

export const EXAMPLE_PAGES = [
  "examples/page.html",
  "examples/lists-page.html",
  "examples/links-page.html",
  "examples/other-page.html",
  "examples/styled-page.html",
  "examples/responsive-page.html",
  "examples/linked-page.html",
  "examples/long-page.html",
  "examples/fragments-page.html",
  "examples/nested/catalog.html",
  "examples/images-page.html",
  "examples/table-page.html",
  "examples/definitions-page.html",
  "examples/blockquote-page.html",
  "examples/hr-page.html",
  "examples/pre-page.html",
  "examples/inset-page.html",
  ...REAL_WORLD_FIXTURES,
] as const;

export const DEFAULT_VIEWPORT = { width: 80, height: 24 } as const;

export const WIDE_VIEWPORT = { width: 60, height: 24 } as const;

export const MEDIUM_VIEWPORT = { width: 40, height: 24 } as const;

export const NARROW_VIEWPORT = { width: 30, height: 24 } as const;

export const COMPARISON_VIEWPORTS = [
  { viewport: NARROW_VIEWPORT, label: "30x24" },
  { viewport: MEDIUM_VIEWPORT, label: "40x24" },
  { viewport: WIDE_VIEWPORT, label: "60x24" },
  { viewport: DEFAULT_VIEWPORT, label: "80x24" },
] as const;

export type ComparisonViewport = (typeof COMPARISON_VIEWPORTS)[number]["viewport"];
