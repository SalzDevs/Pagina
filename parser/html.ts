import * as parse5 from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

export function parseHTML(html: string): DefaultTreeAdapterTypes.Document {
  return parse5.parse(html);
}
