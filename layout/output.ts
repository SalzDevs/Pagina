import type { StyledNode } from "../style/style";
import type { LayoutBox, LayoutFragment } from "./types";

interface NodeLayout {
  layout?: LayoutBox;
  fragments: LayoutFragment[];
}

/** Layout geometry keyed by styled-tree node reference. */
export class LayoutOutput {
  private readonly nodes = new WeakMap<StyledNode, NodeLayout>();

  private entry(node: StyledNode): NodeLayout {
    let entry = this.nodes.get(node);
    if (!entry) {
      entry = { fragments: [] };
      this.nodes.set(node, entry);
    }
    return entry;
  }

  setLayout(node: StyledNode, layout: LayoutBox): void {
    this.entry(node).layout = layout;
  }

  addFragment(node: StyledNode, fragment: LayoutFragment): void {
    this.entry(node).fragments.push(fragment);
  }

  getLayout(node: StyledNode): LayoutBox | undefined {
    return this.nodes.get(node)?.layout;
  }

  getFragments(node: StyledNode): readonly LayoutFragment[] {
    return this.nodes.get(node)?.fragments ?? [];
  }
}
