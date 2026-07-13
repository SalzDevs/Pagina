import { NodeType } from "../dom/node";
import type { LayoutOutput } from "../layout/output";
import type { StyledNode } from "../style/style";
import type { ScrollViewport } from "../viewport/scroll";
import { scrollTo, scrollToAlignTop } from "../viewport/scroll";

/** Find the first laid-out element with the given id attribute. */
export function findElementById(root: StyledNode, id: string): StyledNode | null {
  if (root.dom.type === NodeType.Element && root.dom.attributes?.id === id) {
    return root;
  }

  for (const child of root.children) {
    const found = findElementById(child, id);
    if (found) return found;
  }

  return null;
}

/** Top document row for an element, using layout boxes and text fragments. */
export function elementDocumentTop(node: StyledNode, layout: LayoutOutput): number | null {
  let minY = Infinity;

  const walk = (current: StyledNode): void => {
    const box = layout.getLayout(current);
    if (box) {
      minY = Math.min(minY, box.y);
    }

    for (const fragment of layout.getFragments(current)) {
      minY = Math.min(minY, fragment.y);
    }

    for (const child of current.children) {
      walk(child);
    }
  };

  walk(node);
  return minY === Infinity ? null : minY;
}

/** Map element ids to their document-space scroll targets. */
export function collectFragmentPositions(
  root: StyledNode,
  layout: LayoutOutput,
): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();

  const walk = (node: StyledNode): void => {
    if (node.dom.type === NodeType.Element) {
      const id = node.dom.attributes?.id;
      if (id) {
        const top = elementDocumentTop(node, layout);
        if (top !== null) {
          positions.set(id, top);
        }
      }
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(root);
  return positions;
}

/** Scroll the viewport so a fragment heading sits at the top of the page. */
export function scrollToFragment(
  viewport: ScrollViewport,
  fragmentPositions: ReadonlyMap<string, number>,
  fragment: string | null,
): ScrollViewport {
  if (fragment === null) {
    return scrollTo(viewport, 0);
  }

  const top = fragmentPositions.get(fragment);
  if (top === undefined) return viewport;

  return scrollToAlignTop(viewport, top);
}
