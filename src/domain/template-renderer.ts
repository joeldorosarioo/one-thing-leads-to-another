import { validateData } from './data-model';
import type { FieldValue, PortableDocument } from './document-types';
import { createValueFormatter } from './template-formatting';

export { duration, escapeText } from './template-formatting';

const CLASS_BY_TONE: Record<string, string> = {
  income: 'nts-income',
  expense: 'nts-expense',
  investment: 'nts-investment',
  pending: 'nts-pending',
  success: 'nts-success'
};

const PLACEHOLDER_PATTERN =
  /\{\{\s*(text|number|decimal|integer|money|duration|duration_long|boolean):([a-z][a-z0-9_]*)(?::(income|expense|investment|pending|auto))?\s*\}\}/g;

function applyTone(output: string, tone: string | undefined, value: FieldValue): string {
  if (!tone) return output;

  let resolvedTone = tone;
  if (tone === 'auto') resolvedTone = typeof value === 'number' && value >= 0 ? 'income' : 'expense';
  if (tone === 'pending') resolvedTone = typeof value === 'number' && value > 0 ? 'pending' : 'success';

  return `<span class="${CLASS_BY_TONE[resolvedTone]}">${output}</span>`;
}

export function renderTemplate(template: string, source: PortableDocument): string {
  const values = validateData(source);
  const formatValue = createValueFormatter(source);

  const rendered = template.replace(PLACEHOLDER_PATTERN, (_token, kind: string, key: string, tone?: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`Unknown template field '${key}'.`);
    const value = values[key];
    return applyTone(formatValue(kind, key, value), tone, value);
  });

  if (/\{\{[\s\S]*?\}\}/.test(rendered)) throw new Error('Template contains an unsupported or malformed placeholder.');

  return rendered;
}
