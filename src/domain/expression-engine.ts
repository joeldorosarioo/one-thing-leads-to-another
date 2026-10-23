import { parseExpression } from './expressions/parser';
import { tokenizeExpression } from './expressions/tokenizer';

function evaluateExpression(source: string, resolve: (name: string) => number): number {
  return parseExpression(tokenizeExpression(source), resolve);
}

function computeValues(input: Record<string, number>, formulas: Record<string, string> = {}): Record<string, number> {
  if (!formulas || typeof formulas !== 'object' || Array.isArray(formulas))
    throw new Error('"derived" must be a JSON object.');

  const result = Object.assign(Object.create(null) as Record<string, number>, input);
  const inProgress = new Set<string>();

  function resolve(key: string): number {
    if (Object.prototype.hasOwnProperty.call(result, key)) return result[key];
    if (!Object.prototype.hasOwnProperty.call(formulas, key)) throw new Error(`Unknown field in formula: ${key}`);

    if (inProgress.has(key)) throw new Error(`Circular formula dependency: ${key}`);
    inProgress.add(key);

    try {
      const computed = evaluateExpression(formulas[key], resolve);
      result[key] = computed;

      return computed;
    } finally {
      inProgress.delete(key);
    }
  }

  Object.keys(formulas).forEach(key => {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error(`Invalid derived field name: ${key}`);

    if (Object.prototype.hasOwnProperty.call(input, key))
      throw new Error(`Derived field conflicts with an input field: ${key}`);

    resolve(key);
  });

  return result;
}

export { computeValues, evaluateExpression };
