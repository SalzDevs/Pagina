import { resolve } from "node:path";

import { isRemoteUrl } from "./resolve";

/** Normalize a CLI argument or navigation target to a page location. */
export function normalizePageLocation(input: string): string {
  if (isRemoteUrl(input)) {
    return input;
  }

  return resolve(input);
}
