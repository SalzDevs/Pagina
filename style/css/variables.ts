const VAR_REFERENCE =
  /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*))?\s*\)/gi;

/** Resolve nested CSS var() references against a custom-property map. */
export function resolveVarReferences(
  value: string,
  variables: Record<string, string>,
  depth = 0,
): string {
  if (depth > 8) return value;

  return value.replace(VAR_REFERENCE, (match, name: string, fallback?: string) => {
    const resolved = variables[name]?.trim() ?? fallback?.trim();
    if (!resolved) return match;
    return resolveVarReferences(resolved, variables, depth + 1);
  });
}
