import { isRecord } from '../shared/value-guards';
import type { CalculatedField, ColorRole, DataField, FieldType, PortableDocument } from './document-types';

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const VALID_TYPES = new Set(['number', 'text', 'date', 'boolean']);
const VALID_TONES = new Set(['none', 'income', 'expense', 'investment', 'pending', 'auto']);

export function checkKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key))
    throw new Error(`Invalid field key '${key}'. Use snake_case starting with a letter.`);
}

function readDataField(field: unknown, index: number, usedKeys: Set<string>): DataField {
  if (!isRecord(field)) throw new Error(`Invalid field at index ${index}.`);

  checkKey(field.key);

  if (usedKeys.has(field.key)) throw new Error(`Duplicate field key '${field.key}'.`);
  usedKeys.add(field.key);

  if (typeof field.label !== 'string' || !field.label.trim()) throw new Error(`Field ${field.key} requires a label.`);
  if (typeof field.section !== 'string') throw new Error(`Field ${field.key} requires a section string.`);
  if (!isFieldType(field.type)) throw new Error(`Unsupported type for ${field.key}.`);

  const tone = field.tone || 'none';

  if (!isColorRole(tone)) throw new Error(`Invalid color role for ${field.key}.`);

  if (field.type === 'number' && (typeof field.value !== 'number' || !Number.isFinite(field.value)))
    throw new Error(`Field ${field.key} must have a finite number.`);

  if ((field.type === 'text' || field.type === 'date') && typeof field.value !== 'string')
    throw new Error(`Field ${field.key} must contain text.`);

  if (field.type === 'boolean' && typeof field.value !== 'boolean')
    throw new Error(`Field ${field.key} must be true or false.`);

  if (typeof field.value !== 'string' && typeof field.value !== 'number' && typeof field.value !== 'boolean')
    throw new Error(`Invalid value for ${field.key}.`);

  return {
    ...field,
    key: field.key,
    label: field.label,
    section: field.section,
    type: field.type,
    tone,
    value: field.value
  };
}

function readCalculatedField(entry: unknown, index: number, usedKeys: Set<string>): CalculatedField {
  if (!isRecord(entry)) throw new Error(`Invalid formula at index ${index}.`);

  checkKey(entry.key);

  if (usedKeys.has(entry.key)) throw new Error(`Duplicate field/formula key '${entry.key}'.`);
  usedKeys.add(entry.key);

  if (typeof entry.label !== 'string' || !entry.label.trim()) throw new Error(`Formula ${entry.key} requires a label.`);

  if (typeof entry.expression !== 'string' || !entry.expression.trim())
    throw new Error(`Formula ${entry.key} requires an expression.`);

  const tone = entry.tone || 'none';
  if (!isColorRole(tone)) throw new Error(`Invalid color role for formula ${entry.key}.`);

  return { ...entry, key: entry.key, label: entry.label, expression: entry.expression, tone };
}

export function readDocument(input: unknown): PortableDocument {
  if (!isRecord(input) || input.schema_version !== 1)
    throw new Error('Unsupported data file. Expected schema_version: 1.');

  if (!Array.isArray(input.fields) || !Array.isArray(input.formulas || []))
    throw new Error('Data file needs fields and formulas arrays.');

  if (typeof input.locale !== 'string' || typeof input.currency !== 'string')
    throw new Error('locale and currency must be strings.');

  try {
    new Intl.NumberFormat(input.locale, { style: 'currency', currency: input.currency });
  } catch (_) {
    throw new Error('Invalid locale or currency code.');
  }

  const usedKeys = new Set<string>();
  const rawFields: unknown[] = input.fields;
  const rawFormulas: unknown[] = Array.isArray(input.formulas) ? input.formulas : [];
  const fields = rawFields.map((field, index) => readDataField(field, index, usedKeys));
  const formulas = rawFormulas.map((formula, index) => readCalculatedField(formula, index, usedKeys));

  return { ...input, schema_version: 1, locale: input.locale, currency: input.currency, fields, formulas };
}

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && VALID_TYPES.has(value);
}

export function isColorRole(value: unknown): value is ColorRole {
  return typeof value === 'string' && VALID_TONES.has(value);
}

export { KEY_PATTERN, VALID_TONES, VALID_TYPES };
