export type PresetOutputRule = {
  key: string;
  content: string;
  operation: 'add' | 'replace_optional' | 'disable_optional';
  sortOrder: number;
};
export type BaseOutputRule = { key: string; content: string; optional: boolean; sortOrder: number };

/** Presets may operate on optional rules only; immutable platform rules are never passed here. */
export function mergePresetOutputRules(
  base: BaseOutputRule[],
  preset: PresetOutputRule[]
): BaseOutputRule[] {
  const result = new Map(base.map((rule) => [rule.key, { ...rule }]));
  for (const operation of [...preset].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)
  )) {
    const current = result.get(operation.key);
    if (operation.operation === 'add') {
      if (!current)
        result.set(operation.key, {
          key: operation.key,
          content: operation.content,
          optional: true,
          sortOrder: operation.sortOrder
        });
      continue;
    }
    if (!current?.optional) continue;
    if (operation.operation === 'disable_optional') result.delete(operation.key);
    else
      result.set(operation.key, {
        ...current,
        content: operation.content,
        sortOrder: operation.sortOrder
      });
  }
  return [...result.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)
  );
}

export function parsePresetStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function renderPresetOutputRules(value: string): string[] {
  return parsePresetOutputRuleOperations(value)
    .filter((item) => item.operation !== 'disable_optional')
    .map((item) => item.content.trim())
    .filter(Boolean);
}

export function parsePresetOutputRuleOperations(value: string): PresetOutputRule[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is PresetOutputRule =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as PresetOutputRule).content === 'string' &&
          typeof (item as PresetOutputRule).key === 'string' &&
          typeof (item as PresetOutputRule).sortOrder === 'number' &&
          ['add', 'replace_optional', 'disable_optional'].includes(
            (item as PresetOutputRule).operation
          )
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  } catch {
    return [];
  }
}
