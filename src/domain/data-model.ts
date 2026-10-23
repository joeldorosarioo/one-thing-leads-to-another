import type { FieldValue, PortableDocument } from './document-types';
import { readDocument } from './document-validation';
import { computeValues } from './expression-engine';

export { checkKey, isColorRole, isFieldType, KEY_PATTERN, VALID_TONES, VALID_TYPES } from './document-validation';

function blankDocument(): PortableDocument {
  return {
    schema_version: 1,
    locale: 'en-US',
    currency: 'USD',

    fields: [
      {
        key: 'document_title',
        label: 'Document title',
        section: 'General',
        type: 'text',
        tone: 'none',
        value: 'My document'
      }
    ],

    formulas: []
  };
}

function documentValues(document: PortableDocument): Record<string, FieldValue> {
  const fieldValues: Record<string, FieldValue> = Object.create(null);
  const numericValues: Record<string, number> = Object.create(null);

  for (const field of document.fields) {
    fieldValues[field.key] = field.value;
    if (typeof field.value === 'number') numericValues[field.key] = field.value;
  }

  const expressions: Record<string, string> = Object.create(null);
  for (const formula of document.formulas) expressions[formula.key] = formula.expression;
  return { ...fieldValues, ...computeValues(numericValues, expressions) };
}

function parseDocument(input: unknown): PortableDocument {
  const document = readDocument(input);
  documentValues(document);

  return document;
}

function validateData(input: unknown): Record<string, FieldValue> {
  return documentValues(readDocument(input));
}

export { blankDocument, parseDocument, validateData };
