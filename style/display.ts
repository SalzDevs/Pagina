import type { StyledNode } from "./style";

/** True when a styled node participates in block layout. */
export function isBlock(node: StyledNode): boolean {
  return node.style.display === "block";
}
