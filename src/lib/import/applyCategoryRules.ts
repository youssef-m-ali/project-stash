import type { CategoryRule } from '@/lib/types';

export function applyCategoryRules(
  description: string,
  rules: CategoryRule[],
): string | null {
  const lc = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (lc.includes(rule.pattern.toLowerCase())) return rule.categoryId;
  }
  return null;
}
