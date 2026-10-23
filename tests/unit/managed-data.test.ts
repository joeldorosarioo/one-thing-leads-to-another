import { describe, expect, it } from 'vitest';
import { DATA_DIRECTORY, managedDataPath } from '../../src/application/connections/data-path';

describe('managed data', () => {
  it('uses a stable portable vault-relative path, not the installation folder', () => {
    expect(managedDataPath('doc_abc123')).toBe(`${DATA_DIRECTORY}/doc-abc123.json`);
  });

  it('rejects unsafe connection IDs', () => {
    expect(() => managedDataPath('../other')).toThrow();
    expect(() => managedDataPath('')).toThrow();
  });
});
