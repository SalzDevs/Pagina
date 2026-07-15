import { createCliRenderer } from "@opentui/core";

import { createPaginaApp, DEFAULT_PAGE } from "./app/pagina-app";
import { splitPageLocation } from "./navigation/fragment";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useMouse: true,
  });

  const app = await createPaginaApp(renderer);
  const initial = splitPageLocation(process.argv[2] ?? DEFAULT_PAGE);
  const initialLocation = initial.location || DEFAULT_PAGE;
  await app.loadPage(initialLocation, "push", initial.fragment);
  app.rememberOpenPromptLocation(initialLocation);
  app.start();
}

await main();
