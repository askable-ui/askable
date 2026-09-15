const TRUNCATION_MARKER = '... [truncated]';

export function applyPromptBudget(output: string, maxTokens?: number): string {
  if (maxTokens === undefined) return output;
  if (!Number.isFinite(maxTokens) || maxTokens < 0) {
    throw new RangeError('maxTokens must be a finite, non-negative number.');
  }
  const budget = Math.floor(maxTokens * 4);
  if (output.length <= budget) return output;

  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    const marker = TRUNCATION_MARKER.slice(0, budget);
    return output.slice(0, Math.max(0, budget - marker.length)) + marker;
  }

  // Reduce parsed values before serialization so escapes and delimiters stay valid.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    value = { truncated: true, ...value };
  }
  const reduced = fitJson(value, budget);
  if (reduced === undefined) {
    throw new RangeError('maxTokens is too small to contain valid JSON.');
  }
  return reduced;
}

function fitJson(value: unknown, budget: number): string | undefined {
  const full = JSON.stringify(value);
  if (full.length <= budget) return full;

  if (typeof value === 'string') {
    if (JSON.stringify(TRUNCATION_MARKER).length > budget) return undefined;
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (JSON.stringify(value.slice(0, mid) + TRUNCATION_MARKER).length <= budget) low = mid;
      else high = mid - 1;
    }
    return JSON.stringify(value.slice(0, low) + TRUNCATION_MARKER);
  }
  if (!value || typeof value !== 'object' || budget < 2) return undefined;

  const array = Array.isArray(value);
  const parts: string[] = [];
  let remaining = budget - 2;
  for (const [key, child] of Object.entries(value)) {
    const prefix = array ? '' : `${JSON.stringify(key)}:`;
    const separator = parts.length ? 1 : 0;
    const next = fitJson(child, remaining - prefix.length - separator);
    if (next === undefined) {
      if (array) break;
      continue;
    }
    parts.push(prefix + next);
    remaining -= prefix.length + next.length + separator;
  }
  return array ? `[${parts.join(',')}]` : `{${parts.join(',')}}`;
}
