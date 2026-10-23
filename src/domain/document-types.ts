export type FieldType = 'number' | 'text' | 'date' | 'boolean';
export type ColorRole = 'none' | 'income' | 'expense' | 'investment' | 'pending' | 'auto';
export type FieldValue = string | number | boolean;

export interface DataField {
  key: string;
  label: string;
  section: string;
  type: FieldType;
  tone: ColorRole;
  value: FieldValue;
}

export interface CalculatedField {
  key: string;
  label: string;
  expression: string;
  tone: ColorRole;
}

export interface PortableDocument {
  schema_version: 1;
  locale: string;
  currency: string;
  fields: DataField[];
  formulas: CalculatedField[];
}

export type CalculatedValues = Record<string, FieldValue>;
