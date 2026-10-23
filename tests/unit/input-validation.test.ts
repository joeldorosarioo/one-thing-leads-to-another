import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { parseDocument, validateData } from '../../src/domain/data-model';
import { parseSettings } from '../../src/application/connections/connection-types';
import { errorMessage } from '../../src/shared/error-message';

describe('external input boundaries', () => {
  it('normalizes optional document properties without losing custom data or mutating the input', () => {
    const input = {
      schema_version: 1,
      locale: 'en-US',
      currency: 'USD',

      metadata: {
        owner: 'author'
      },

      fields: [
        {
          key: 'ready',
          label: 'Ready',
          section: 'General',
          type: 'boolean',
          value: true,
          custom: 'kept'
        }
      ]
    };

    const document = parseDocument(input);

    expect(document).toMatchObject({
      metadata: {
        owner: 'author'
      },

      formulas: [],

      fields: [
        {
          custom: 'kept',
          tone: 'none'
        }
      ]
    });

    expect(validateData(document)).toEqual({ ready: true });
    expect(input).not.toHaveProperty('formulas');
    expect(input.fields[0]).not.toHaveProperty('tone');
  });

  it.each([
    null,
    [],
    { schema_version: 1 },
    {
      schema_version: 1,
      locale: 'en-US',
      currency: 'USD',

      fields: [
        {
          key: 'ready',
          label: 'Ready',
          section: 'General',
          type: 'boolean',
          value: 'true'
        }
      ]
    }
  ])('rejects invalid source data before it can be edited', input => {
    expect(() => parseDocument(input)).toThrow();
  });

  it('loads complete saved connections without losing hashes or custom settings', () => {
    const job = {
      id: 'one',
      title: 'Report',
      data_path: 'data.json',
      template_path: 'template.md',
      output_path: 'report.md',
      enabled: false,
      last_output_hash: 'abc123',
      custom: 'kept'
    };

    expect(parseSettings({ jobs: [job] })).toEqual({ jobs: [job] });
    expect(parseSettings(null)).toEqual({ jobs: [] });
    expect(parseSettings({})).toEqual({ jobs: [] });
  });

  it.each([{ jobs: [null] }, { jobs: [{ id: 'one' }] }, { jobs: 'invalid' }])(
    'rejects malformed settings instead of silently dropping connections',
    input => {
      expect(() => parseSettings(input)).toThrow(/Invalid saved/);
    }
  );

  const foreignError: unknown = runInNewContext('new Error("Foreign error")');

  it.each([
    [new Error('Local error'), 'Local error'],
    [foreignError, 'Foreign error'],
    [{ message: 'Plain error' }, 'Plain error'],
    ['Disk unavailable', 'Disk unavailable'],
    [null, 'Unknown error.'],
    [undefined, 'Unknown error.'],
    [{ message: 42 }, 'Unknown error.']
  ])('extracts a safe message from thrown values', (error, expected) => {
    expect(errorMessage(error)).toBe(expected);
  });
});
