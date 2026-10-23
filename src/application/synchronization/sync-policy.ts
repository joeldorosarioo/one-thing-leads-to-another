export type SyncResult = 'created' | 'updated' | 'unchanged' | 'conflict';
export type SyncStatus = 'up-to-date' | 'pending' | 'automatic' | 'conflict' | 'error';

export function deriveSyncControls(
  result: SyncResult,
  autoSyncEnabled: boolean
): {
  status: SyncStatus;
  canManualSync: boolean;
  label: string;
} {
  if (result === 'unchanged') return { status: 'up-to-date', canManualSync: false, label: 'Up to date' };
  if (result === 'conflict') return { status: 'conflict', canManualSync: true, label: 'Review external changes' };
  if (autoSyncEnabled) return { status: 'automatic', canManualSync: false, label: 'Updating automatically…' };

  return { status: 'pending', canManualSync: true, label: 'Pending changes · Auto-sync off' };
}

export function fingerprint(content: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function requiresOverwriteConfirmation(
  generated: string,
  existing: string | null,
  lastGeneratedFingerprint?: string
): boolean {
  if (existing === null || existing === generated) return false;
  if (!lastGeneratedFingerprint) return true;

  return fingerprint(existing) !== lastGeneratedFingerprint;
}
