import { parseDocument, validateData } from '../../domain/data-model';
import type { CalculatedField, DataField, FieldValue, PortableDocument } from '../../domain/document-types';
import { errorMessage } from '../../shared/error-message';
import { isRecord } from '../../shared/value-guards';
import type { FormatDraft } from '../connections/connection-types';
import { isVaultFile, type VaultPort } from '../ports/vault-port';

export type FieldSelection = { key: string; kind: 'field' | 'formula' };

export type FieldChange = ({ kind: 'field'; entity: DataField } | { kind: 'formula'; entity: CalculatedField }) & {
  mode: 'create' | 'edit';
};

export function createDocumentService(vault: VaultPort) {
  const pending = new Map<string, Promise<void>>();
  let disposed = false;

  async function readInput(path: string): Promise<unknown> {
    const file = vault.getAbstractFileByPath(path);
    if (!isVaultFile(file)) throw new Error('Data file not found.');

    let input: unknown;

    try {
      input = JSON.parse(await vault.read(file));
    } catch (error) {
      throw new Error(`Invalid JSON: ${errorMessage(error)}`);
    }

    return input;
  }

  async function read(path: string): Promise<PortableDocument> {
    return parseDocument(await readInput(path));
  }

  async function write(path: string, transform: (input: unknown) => PortableDocument | null): Promise<void> {
    const previous = pending.get(path) ?? Promise.resolve();

    const next = previous
      .catch(() => {})
      .then(async () => {
        if (disposed) return;
        const input = await readInput(path);

        if (disposed) return;
        const document = transform(input);

        if (!document) return;
        validateData(document);
        const file = vault.getAbstractFileByPath(path);

        if (!isVaultFile(file)) throw new Error('Data file not found.');
        await vault.modify(file, JSON.stringify(document, null, 2) + '\n');
      });

    pending.set(path, next);

    try {
      await next;
    } finally {
      if (pending.get(path) === next) pending.delete(path);
    }
  }

  function update(path: string, mutate: (document: PortableDocument) => void): Promise<void> {
    return write(path, input => {
      const document = parseDocument(input);
      mutate(document);
      return document;
    });
  }

  function updateValue(path: string, key: string, value: FieldValue): Promise<void> {
    return update(path, document => {
      const field = document.fields.find(item => item.key === key);
      if (!field) throw new Error(`Unknown field '${key}'.`);
      field.value = value;
    });
  }

  function saveField(path: string, change: FieldChange): Promise<void> {
    return update(path, document => {
      const { entity, mode } = change;

      if (mode === 'create' && [...document.fields, ...document.formulas].some(item => item.key === entity.key)) {
        throw new Error('Key already exists.');
      }

      function upsert<T extends DataField | CalculatedField>(items: T[], item: T): void {
        const index = items.findIndex(existing => existing.key === item.key);

        if (mode === 'edit') {
          if (index < 0) throw new Error('Field was removed.');
          items[index] = { ...item };
        } else {
          items.push({ ...item });
        }
      }

      if (change.kind === 'formula') upsert(document.formulas, change.entity);
      else upsert(document.fields, change.entity);
    });
  }

  function deleteField(path: string, selection: FieldSelection): Promise<void> {
    return update(path, document => {
      if (selection.kind === 'formula')
        document.formulas = document.formulas.filter(item => item.key !== selection.key);
      else document.fields = document.fields.filter(item => item.key !== selection.key);
    });
  }

  function updateFormats(path: string, format: FormatDraft): Promise<void> {
    return write(path, input => {
      if (!isRecord(input)) throw new Error('Unsupported data file. Expected schema_version: 1.');
      const document = parseDocument({ ...input, ...format });

      if (input.locale === document.locale && input.currency === document.currency) return null;
      return document;
    });
  }

  async function readFormats(path: string): Promise<FormatDraft> {
    try {
      const input = await readInput(path);

      return {
        locale: isRecord(input) && typeof input.locale === 'string' && input.locale ? input.locale : 'en-US',
        currency: isRecord(input) && typeof input.currency === 'string' && input.currency ? input.currency : 'USD'
      };
    } catch {
      return { locale: 'en-US', currency: 'USD' };
    }
  }

  return {
    read,
    updateValue,
    saveField,
    deleteField,
    updateFormats,
    readFormats,

    dispose: () => {
      disposed = true;
    }
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
