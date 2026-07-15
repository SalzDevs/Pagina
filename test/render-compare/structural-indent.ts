import { layout } from "../../layout/layout";
import type { LayoutOutput } from "../../layout/output";
import { loadPageContent } from "../../navigation/load-page";
import type { StyledNode } from "../../style/style";
import { DEFAULT_VIEWPORT } from "./fixtures";

export interface LayoutTextFragment {
  x: number;
  y: number;
  text: string;
}

export interface StructuralLayout {
  pagePath: string;
  styled: StyledNode;
  output: LayoutOutput;
  viewport: { width: number; height: number };
}

/** Load an example page and lay it out for structural indent checks. */
export async function buildStructuralLayout(
  pagePath: string,
  viewport: { width: number; height: number } = DEFAULT_VIEWPORT,
): Promise<StructuralLayout> {
  const page = await loadPageContent(pagePath, { viewportWidth: viewport.width });
  const laidOut = layout(page.styled, { viewport });

  return {
    pagePath,
    styled: page.styled,
    output: laidOut.output,
    viewport,
  };
}

/** Collect layout fragments under a styled subtree. */
export function collectLayoutFragments(
  output: LayoutOutput,
  root: StyledNode,
): LayoutTextFragment[] {
  const fragments: LayoutTextFragment[] = [];

  const walk = (node: StyledNode) => {
    for (const fragment of output.getFragments(node)) {
      fragments.push({
        x: fragment.x,
        y: fragment.y,
        text: fragment.text,
      });
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  walk(root);
  return fragments;
}

/** Find the first fragment whose trimmed text matches a predicate. */
export function findLayoutFragment(
  fragments: LayoutTextFragment[],
  predicate: (text: string) => boolean,
): LayoutTextFragment | undefined {
  return fragments.find((fragment) => predicate(fragment.text.trim()));
}

/** Assert a fragment exists at an expected x-offset with a readable failure message. */
export function expectLayoutX(
  fragment: LayoutTextFragment | undefined,
  expectedX: number,
  label: string,
): void {
  const actualX = fragment?.x;
  const message =
    actualX === undefined
      ? `${label}: fragment not found (expected x=${expectedX})`
      : `${label}: expected x=${expectedX}, got x=${actualX}`;

  expect(actualX, message).toBe(expectedX);
}

/** Assert each label indents further left than the previous one. */
export function expectIncreasingLayoutX(
  levels: Array<{ label: string; fragment: LayoutTextFragment | undefined }>,
): void {
  for (let index = 1; index < levels.length; index++) {
    const previous = levels[index - 1]!;
    const current = levels[index]!;
    const previousX = previous.fragment?.x;
    const currentX = current.fragment?.x;

    const message =
      previousX === undefined || currentX === undefined
        ? `${current.label} should indent more than ${previous.label}, but one fragment was missing`
        : `${current.label} (x=${currentX}) should indent more than ${previous.label} (x=${previousX})`;

    expect(currentX, message).toBeGreaterThan(previousX ?? -1);
  }
}

/** Format structural offsets for snapshot-style diff output in test failures. */
export function formatStructuralOffsets(
  labels: Array<{ label: string; fragment: LayoutTextFragment | undefined }>,
): string {
  return labels
    .map(({ label, fragment }) => {
      if (!fragment) return `${label}: missing`;
      return `${label}: x=${fragment.x} y=${fragment.y} text=${JSON.stringify(fragment.text.trim())}`;
    })
    .join("\n");
}
