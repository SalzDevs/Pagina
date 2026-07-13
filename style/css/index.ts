import type { Node } from "../../dom/node";
import { NodeType } from "../../dom/node";
import type { CssRule, CssSelector, SimpleSelector } from "./types";

export interface RuleSelectorRef {
  ruleIndex: number;
  selectorIndex: number;
  selector: CssSelector;
}

export interface CssRuleIndex {
  rules: CssRule[];
  buckets: Map<string, RuleSelectorRef[]>;
}

function bucketKey(kind: "tag" | "class" | "id", value: string): string {
  return `${kind}:${value}`;
}

function addToBucket(
  buckets: Map<string, RuleSelectorRef[]>,
  key: string,
  ref: RuleSelectorRef,
): void {
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.push(ref);
    return;
  }

  buckets.set(key, [ref]);
}

function indexSimpleSelector(
  selector: SimpleSelector,
  ref: RuleSelectorRef,
  buckets: Map<string, RuleSelectorRef[]>,
): void {
  switch (selector.kind) {
    case "tag":
      addToBucket(buckets, bucketKey("tag", selector.tag), ref);
      break;
    case "class":
      addToBucket(buckets, bucketKey("class", selector.className), ref);
      break;
    case "id":
      addToBucket(buckets, bucketKey("id", selector.id), ref);
      break;
    case "tag-class":
      addToBucket(buckets, bucketKey("tag", selector.tag), ref);
      addToBucket(buckets, bucketKey("class", selector.className), ref);
      break;
    case "tag-id":
      addToBucket(buckets, bucketKey("tag", selector.tag), ref);
      addToBucket(buckets, bucketKey("id", selector.id), ref);
      break;
  }
}

function indexSelector(
  selector: CssSelector,
  ref: RuleSelectorRef,
  buckets: Map<string, RuleSelectorRef[]>,
): void {
  if (selector.kind === "descendant") {
    const target = selector.chain[selector.chain.length - 1];
    if (target) {
      indexSimpleSelector(target, ref, buckets);
    }
    return;
  }

  indexSimpleSelector(selector, ref, buckets);
}

/** Build a selector index for stylesheet rules. */
export function buildRuleIndex(rules: CssRule[]): CssRuleIndex {
  const buckets = new Map<string, RuleSelectorRef[]>();

  for (const [ruleIndex, rule] of rules.entries()) {
    for (const [selectorIndex, selector] of rule.selectors.entries()) {
      indexSelector(selector, { ruleIndex, selectorIndex, selector }, buckets);
    }
  }

  return { rules, buckets };
}

function elementClasses(node: Node): string[] {
  if (node.type !== NodeType.Element) return [];

  const value = node.attributes?.class;
  if (!value) return [];

  return value.split(/\s+/).filter(Boolean);
}

/** Return rule indices that might match an element, in document order. */
export function candidateRuleIndices(index: CssRuleIndex, node: Node): number[] {
  if (node.type !== NodeType.Element) return [];

  const tag = node.tag ?? "";
  const classes = elementClasses(node);
  const id = node.attributes?.id;

  const seen = new Set<number>();
  const candidates: number[] = [];

  const addBucket = (key: string | undefined) => {
    if (!key) return;

    for (const ref of index.buckets.get(key) ?? []) {
      if (seen.has(ref.ruleIndex)) continue;
      seen.add(ref.ruleIndex);
      candidates.push(ref.ruleIndex);
    }
  };

  addBucket(bucketKey("tag", tag));
  for (const className of classes) {
    addBucket(bucketKey("class", className));
  }
  if (id) {
    addBucket(bucketKey("id", id));
  }

  candidates.sort((left, right) => left - right);
  return candidates;
}
