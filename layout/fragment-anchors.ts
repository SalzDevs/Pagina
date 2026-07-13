import { NodeType } from "../dom/node";
import type { LayoutOutput } from "./output";
import type { LayoutFragment } from "./types";
import type { StyledNode } from "../style/style";

export interface FragmentAnchorFrame {
  id: string;
  minY: number;
}

export interface FragmentTracking {
  fragmentPositions: Map<string, number>;
  fragmentAnchorStack: FragmentAnchorFrame[];
  output: LayoutOutput;
}

export function elementId(node: StyledNode): string | undefined {
  if (node.dom.type !== NodeType.Element) return undefined;
  return node.dom.attributes?.id;
}

export function noteLayoutY(tracking: FragmentTracking, y: number): void {
  for (const frame of tracking.fragmentAnchorStack) {
    frame.minY = Math.min(frame.minY, y);
  }
}

export function pushFragmentAnchor(tracking: FragmentTracking, node: StyledNode): void {
  const id = elementId(node);
  if (!id) return;

  tracking.fragmentAnchorStack.push({ id, minY: Infinity });
}

export function popFragmentAnchor(tracking: FragmentTracking, node: StyledNode): void {
  const id = elementId(node);
  if (!id) return;

  const frame = tracking.fragmentAnchorStack.pop();
  if (!frame || frame.id !== id || frame.minY === Infinity) return;

  tracking.fragmentPositions.set(id, frame.minY);
}

export function addTrackedFragment(
  tracking: FragmentTracking,
  node: StyledNode,
  fragment: LayoutFragment,
): void {
  tracking.output.addFragment(node, fragment);
  noteLayoutY(tracking, fragment.y);
}
