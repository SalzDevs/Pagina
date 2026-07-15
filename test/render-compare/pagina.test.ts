import { describe, expect, test } from "bun:test";

import { buildPaginaRender } from "./pagina";
import { DEFAULT_VIEWPORT } from "./fixtures";

describe("buildPaginaRender", () => {
  test("loads remote https URLs without path.resolve breaking the location", async () => {
    const pagina = await buildPaginaRender("https://example.com/", DEFAULT_VIEWPORT);

    expect(pagina.pageTitle).toBe("Example Domain");
    expect(pagina.plainText).toContain("Example Domain");
    expect(pagina.plainText).not.toContain("Could not load page");
    expect(pagina.links[0]?.href).toBe("https://iana.org/domains/example");
  });
});
