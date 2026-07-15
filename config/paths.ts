import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Directory for Pagina user config (history, bookmarks). */
export function paginaConfigDir(): string {
  const override = process.env.PAGINA_CONFIG_DIR;
  if (override) return resolve(override);

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return resolve(xdg, "pagina");

  return resolve(homedir(), ".config", "pagina");
}

export function openPromptHistoryPath(): string {
  return join(paginaConfigDir(), "history.json");
}

export function bookmarksPath(): string {
  return join(paginaConfigDir(), "bookmarks.json");
}
