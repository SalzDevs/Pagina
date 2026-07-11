import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import type { CssRule } from "./types";
import { parseStylesheet } from "./parse";

/** Collect CSS text from `<style>` elements in the DOM. */
export function collectStylesheetRules(root: Node): CssRule[] {
  const cssTexts: string[] = [];

  const walk = (node: Node): void => {
    if (node.type === NodeType.Element && node.tag === "style") {
      const text = node.children
        ?.filter((child) => child.type === NodeType.Text)
        .map((child) => child.value ?? "")
        .join("");

      if (text) cssTexts.push(text);
      return;
    }

    node.children?.forEach(walk);
  };

  walk(root);

  return cssTexts.flatMap(parseStylesheet);
}
