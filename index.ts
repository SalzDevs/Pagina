import { createCliRenderer } from "@opentui/core";
import { parseHTML } from "./parser/html";
import {convert} from "./parser/convert"
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

  const document =  parseHTML(html);

  const dom = convert(document);

  render(renderer, dom);

  renderer.start();
}

await main();
