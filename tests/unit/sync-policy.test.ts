import { describe, expect, it } from 'vitest';

import {
  deriveSyncControls,
  fingerprint,
  requiresOverwriteConfirmation
} from '../../src/application/synchronization/sync-policy';

describe('sync policy', () => {
  it('disables manual sync when report is current', () => {
    expect(deriveSyncControls('unchanged', false).canManualSync).toBe(false);
    expect(deriveSyncControls('unchanged', true).canManualSync).toBe(false);
  });

  it('leaves changes pending when automatic sync is disabled', () => {
    expect(deriveSyncControls('updated', false)).toMatchObject({ status: 'pending', canManualSync: true });
  });

  it('delegates enabled changes to automatic sync', () => {
    expect(deriveSyncControls('updated', true)).toMatchObject({ status: 'automatic', canManualSync: false });
  });

  it('enables manual review on conflicts even with automatic updates', () => {
    expect(deriveSyncControls('conflict', true)).toMatchObject({ status: 'conflict', canManualSync: true });
  });

  it('protects externally modified output and legacy output without a fingerprint', () => {
    expect(requiresOverwriteConfirmation('new', 'manual')).toBe(true);
    expect(requiresOverwriteConfirmation('new', 'old', fingerprint('old'))).toBe(false);
    expect(requiresOverwriteConfirmation('new', 'manual', fingerprint('old'))).toBe(true);
    expect(requiresOverwriteConfirmation('same', 'same')).toBe(false);
  });
});
