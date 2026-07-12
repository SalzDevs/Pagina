import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { convert } from "../parser/convert";
import { parseHTML } from "../parser/html";
import { computeStyles, type StyledNode } from "../style/style";
import { collectCssSources, collectStylesheetRules } from "../style/css/collect";
import { matchesSelector } from "../style/css/match";
import { parseInlineStyle, parseStylesheet, preprocessStylesheet } from "../style/css/parse";

function findBody(styled: StyledNode) {
  return styled.children[0]?.children.find(
    (child) => child.dom.type === "element" && child.dom.tag === "body",
  );
}

describe("parseStylesheet", () => {
  test("parses tag, class, and id selectors", () => {
    const rules = parseStylesheet(`
      body { color: #ccc; background: #111; }
      p.intro { color: cyan; }
      #title { font-weight: bold; }
    `);

    expect(rules).toHaveLength(3);
    expect(rules[0]?.declarations.color).toBe("#ccc");
    expect(rules[1]?.selectors[0]).toEqual({ kind: "tag-class", tag: "p", className: "intro" });
    expect(rules[2]?.selectors[0]).toEqual({ kind: "id", id: "title" });
  });

  test("parses spacing properties", () => {
    const rules = parseStylesheet("p { margin-top: 2; padding-bottom: 1; }");
    expect(rules[0]?.declarations.marginTop).toBe(2);
    expect(rules[0]?.declarations.paddingBottom).toBe(1);
  });

  test("parses font-size values", () => {
    const rules = parseStylesheet(`
      p { font-size: 24px; }
      h1 { font-size: 1.5em; }
      small { font-size: small; }
    `);

    expect(rules[0]?.declarations.fontSize).toBe(1.5);
    expect(rules[1]?.declarations.fontSize).toBe(1.5);
    expect(rules[2]?.declarations.fontSize).toBe(0.875);
  });

  test("parses descendant selectors", () => {
    const rules = parseStylesheet(`
      body a { color: cyan; }
      body p.intro { color: yellow; }
    `);

    expect(rules[0]?.selectors[0]).toEqual({
      kind: "descendant",
      chain: [{ kind: "tag", tag: "body" }, { kind: "tag", tag: "a" }],
    });
    expect(rules[1]?.selectors[0]).toEqual({
      kind: "descendant",
      chain: [
        { kind: "tag", tag: "body" },
        { kind: "tag-class", tag: "p", className: "intro" },
      ],
    });
  });

  test("ignores keyframes blocks without corrupting surrounding rules", () => {
    const rules = parseStylesheet(`
      body { color: red; }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      p { color: blue; }
    `);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.declarations.color).toBe("red");
    expect(rules[1]?.declarations.color).toBe("blue");
  });

  test("unwraps media blocks and keeps their rules", () => {
    const rules = parseStylesheet(`
      body { color: red; }
      @media screen {
        h1 { color: gold; }
      }
    `);

    expect(rules).toHaveLength(2);
    expect(rules[0]?.declarations.color).toBe("red");
    expect(rules[1]?.selectors[0]).toEqual({ kind: "tag", tag: "h1" });
    expect(rules[1]?.declarations.color).toBe("gold");
  });

  test("preprocessStylesheet removes font-face blocks", () => {
    const css = preprocessStylesheet(`
      body { color: red; }
      @font-face {
        font-family: "Example";
        src: url(font.woff2);
      }
      p { color: blue; }
    `);

    expect(css).toContain("body { color: red; }");
    expect(css).toContain("p { color: blue; }");
    expect(css).not.toContain("@font-face");
  });
});

describe("computeStyles with CSS", () => {
  test("applies stylesheet rules over UA defaults", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { color: #cccccc; background: #111111; }
            h1 { color: #ffd700; }
          </style>
        </head>
        <body>
          <h1>Title</h1>
        </body>
      </html>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const heading = body?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "h1",
    );

    expect(body?.style.fg).toBe("#cccccc");
    expect(body?.style.bg).toBe("#111111");
    expect(heading?.style.fg).toBe("#ffd700");
  });

  test("applies class and id selectors", async () => {
    const html = `
      <style>
        p.note { color: blue; }
        #main { color: green; font-weight: bold; }
      </style>
      <p class="note">A</p>
      <p id="main">B</p>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const note = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "note",
    );
    const main = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.id === "main",
    );

    expect(note?.style.fg).toBe("blue");
    expect(main?.style.fg).toBe("green");
    expect(main?.style.bold).toBe(true);
  });

  test("inline style overrides stylesheet rules", async () => {
    const html = `
      <style>p { color: blue; }</style>
      <p style="color: red;">hello</p>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const paragraph = body?.children[0];

    expect(paragraph?.style.fg).toBe("red");
  });

  test("loads linked stylesheets from examples/linked-page.html", async () => {
    const html = await Bun.file("examples/linked-page.html").text();
    const styled = await computeStyles(convert(parseHTML(html)), {
      pageLocation: resolve("examples/linked-page.html"),
    });
    const body = findBody(styled);
    const intro = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "intro",
    );
    const highlight = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.id === "highlight",
    );

    expect(body?.style.fg).toBe("#cccccc");
    expect(intro?.style.fg).toBe("#8be9fd");
    expect(highlight?.style.fg).toBe("#50fa7b");
    expect(highlight?.style.bold).toBe(true);
  });

  test("applies descendant selectors from a stylesheet", async () => {
    const html = `
      <style>
        body a { color: cyan; }
        body p.note { color: yellow; }
      </style>
      <body>
        <p class="note">Intro <a href="#">link</a></p>
      </body>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const note = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "note",
    );
    const link = note?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "a",
    );

    expect(note?.style.fg).toBe("yellow");
    expect(link?.style.fg).toBe("cyan");
  });

  test("applies font-size and uses bold for larger text", async () => {
    const html = `
      <style>
        p.lead { font-size: 24px; color: white; }
        p.small { font-size: 12px; color: gray; }
      </style>
      <p class="lead">Large</p>
      <p class="small">Small</p>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const lead = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "lead",
    );
    const small = body?.children.find(
      (child) =>
        child.dom.type === "element" &&
        child.dom.tag === "p" &&
        child.dom.attributes?.class === "small",
    );

    expect(lead?.style.fontSize).toBe(1.5);
    expect(lead?.style.bold).toBe(true);
    expect(lead?.style.fg).toBe("white");
    expect(small?.style.fontSize).toBe(0.75);
    expect(small?.style.bold).toBe(false);
  });

  test("applies rules wrapped in media queries", async () => {
    const html = `
      <style>
        @media screen {
          body { color: #cccccc; }
          h1 { color: #ffd700; }
        }
      </style>
      <body>
        <h1>Title</h1>
      </body>
    `;

    const styled = await computeStyles(convert(parseHTML(html)));
    const body = findBody(styled);
    const heading = body?.children.find(
      (child) => child.dom.type === "element" && child.dom.tag === "h1",
    );

    expect(body?.style.fg).toBe("#cccccc");
    expect(heading?.style.fg).toBe("#ffd700");
  });
});

describe("matchesSelector", () => {
  test("matches element attributes from the DOM", () => {
    const dom = convert(parseHTML(`<p class="note" id="main"></p>`));
    const body = dom.children[0]?.children.find(
      (child) => child.type === "element" && child.tag === "body",
    );
    const node = body?.children[0];

    expect(node).toBeDefined();
    if (!node || node.type !== "element") throw new Error("expected element");

    expect(matchesSelector(node, { kind: "tag", tag: "p" })).toBe(true);
    expect(matchesSelector(node, { kind: "class", className: "note" })).toBe(true);
    expect(matchesSelector(node, { kind: "id", id: "main" })).toBe(true);
    expect(matchesSelector(node, { kind: "tag-class", tag: "p", className: "note" })).toBe(true);
  });

  test("matches descendant selectors against ancestor chains", () => {
    const dom = convert(
      parseHTML(`
        <body>
          <p class="note"><a href="#">link</a></p>
        </body>
      `),
    );
    const html = dom.children?.[0];
    const body = html?.children?.find((child) => child.type === "element" && child.tag === "body");
    const paragraph = body?.children?.find(
      (child) => child.type === "element" && child.tag === "p",
    );
    const link = paragraph?.children?.find(
      (child) => child.type === "element" && child.tag === "a",
    );

    expect(body).toBeDefined();
    expect(paragraph).toBeDefined();
    expect(link).toBeDefined();
    if (!body || !paragraph || !link || link.type !== "element") {
      throw new Error("expected body, paragraph, and link");
    }

    expect(
      matchesSelector(
        link,
        {
          kind: "descendant",
          chain: [{ kind: "tag", tag: "body" }, { kind: "tag", tag: "a" }],
        },
        [body, paragraph],
      ),
    ).toBe(true);

    expect(
      matchesSelector(
        link,
        {
          kind: "descendant",
          chain: [{ kind: "tag", tag: "body" }, { kind: "tag", tag: "p" }],
        },
        [body, paragraph],
      ),
    ).toBe(false);
  });
});

describe("collectStylesheetRules", () => {
  test("reads rules from style elements", async () => {
    const dom = convert(parseHTML("<html><head><style>h1 { color: red; }</style></head></html>"));
    const rules = await collectStylesheetRules(dom);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.declarations.color).toBe("red");
  });

  test("collects stylesheet links in document order", () => {
    const dom = convert(
      parseHTML(`
        <html>
          <head>
            <link rel="stylesheet" href="theme.css" />
            <style>body { color: white; }</style>
          </head>
        </html>
      `),
    );

    expect(collectCssSources(dom)).toEqual([
      { kind: "link", href: "theme.css" },
      { kind: "inline", text: "body { color: white; }" },
    ]);
  });

  test("loads linked rules when a base path is provided", async () => {
    const dom = convert(parseHTML('<link rel="stylesheet" href="theme.css" />'));
    const rules = await collectStylesheetRules(dom, resolve("examples/linked-page.html"));

    expect(rules.some((rule) => rule.declarations.color === "#cccccc")).toBe(true);
    expect(rules.some((rule) => rule.declarations.color === "#ffd700")).toBe(true);
  });

  test("loads linked rules from a remote stylesheet", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      expect(input).toBe("https://example.com/theme.css");
      return new Response("body { color: navy; }", { status: 200 });
    }) as typeof fetch;

    try {
      const dom = convert(parseHTML('<link rel="stylesheet" href="theme.css" />'));
      const rules = await collectStylesheetRules(dom, "https://example.com/page.html");

      expect(rules.some((rule) => rule.declarations.color === "navy")).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("parseInlineStyle", () => {
  test("parses inline declarations", () => {
    expect(parseInlineStyle("color: red; font-weight: bold").color).toBe("red");
    expect(parseInlineStyle("color: red; font-weight: bold").fontWeight).toBe("bold");
  });
});
