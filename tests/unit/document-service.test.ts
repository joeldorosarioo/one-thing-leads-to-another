import { describe, expect, it } from 'vitest';
import { createDocumentService } from '../../src/application/document-editing/document-service';
import type { VaultPort } from '../../src/application/ports/vault-port';

function createSource() {
  let content = JSON.stringify({
    schema_version: 1,
    locale: 'en-US',
    currency: 'USD',

    metadata: {
      owner: 'author'
    },

    fields: [
      {
        key: 'count',
        label: 'Count',
        section: 'General',
        type: 'number',
        tone: 'none',
        value: 0
      },
      {
        key: 'ready',
        label: 'Ready',
        section: 'General',
        type: 'boolean',
        tone: 'none',
        value: false
      }
    ],

    formulas: []
  });

  const vault: VaultPort = {
    getAbstractFileByPath: path => ({ path, extension: 'json' }),

    async read() {
      const snapshot = content;
      await Promise.resolve();
      return snapshot;
    },

    async modify(_file, value) {
      content = value;
    },

    async create(path) {
      return { path, extension: 'json' };
    },

    async createFolder() {}
  };

  return {
    service: createDocumentService(vault),
    document: () => JSON.parse(content)
  };
}

describe('document editing', () => {
  it('serializes concurrent edits to one source without losing either value or custom metadata', async () => {
    const { service, document } = createSource();

    await Promise.all([
      service.updateValue('source.json', 'count', 4),
      service.updateValue('source.json', 'ready', true)
    ]);

    expect(document()).toMatchObject({
      metadata: {
        owner: 'author'
      },

      fields: [{ value: 4 }, { value: true }]
    });
  });

  it('allows a valid edit after an earlier queued edit fails validation', async () => {
    const { service, document } = createSource();

    const invalid = service.updateValue('source.json', 'count', 'invalid');
    const valid = service.updateValue('source.json', 'ready', true);

    await expect(invalid).rejects.toThrow(/finite number/);
    await valid;

    expect(document().fields.map((field: { value: unknown }) => field.value)).toEqual([0, true]);
  });

  it('keeps the original document when regional settings are invalid', async () => {
    const { service, document } = createSource();

    await expect(
      service.updateFormats('source.json', {
        locale: 'not-a-locale!',
        currency: 'USD'
      })
    ).rejects.toThrow();

    expect(document().locale).toBe('en-US');
  });

  it('rejects a field whose key is already used by a formula', async () => {
    const { service } = createSource();

    await service.saveField('source.json', {
      kind: 'formula',
      mode: 'create',

      entity: {
        key: 'total',
        label: 'Total',
        expression: 'count + 1',
        tone: 'none'
      }
    });

    await expect(
      service.saveField('source.json', {
        kind: 'field',
        mode: 'create',

        entity: {
          key: 'total',
          label: 'Other',
          section: 'General',
          type: 'number',
          tone: 'none',
          value: 0
        }
      })
    ).rejects.toThrow(/Key already exists/);
  });

  it('preserves a referenced field if deleting it would invalidate a formula', async () => {
    const { service, document } = createSource();

    await service.saveField('source.json', {
      kind: 'formula',
      mode: 'create',

      entity: {
        key: 'total',
        label: 'Total',
        expression: 'count + 1',
        tone: 'none'
      }
    });

    await expect(
      service.deleteField('source.json', {
        kind: 'field',
        key: 'count'
      })
    ).rejects.toThrow(/Unknown field/);

    expect(document().fields[0].key).toBe('count');
  });
});
