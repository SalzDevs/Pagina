import { createCliRenderer } from "@opentui/core";

import { convert } from "./parser/convert";
import { parseHTML } from "./parser/html";
import { layout } from "./layout/layout";
import { paint } from "./paint/paint";
import { render } from "./render/render";

const html = `
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello!</h1>
    <p>This is <strong>OpenTUI</strong>.</p>
  </body>
</html>
`;

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  const document = parseHTML(html);
  const dom = convert(document);

  layout(dom);
  const displayList = paint(dom);
  render(renderer, displayList);

  renderer.start();
}

await main();
