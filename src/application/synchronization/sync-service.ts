import type { ConnectionService } from '../connections/connection-service';
import { inspectDocument, writeDocument } from '../document-generation/generate-document';
import { isVaultFile, type VaultPort } from '../ports/vault-port';
import { fingerprint, requiresOverwriteConfirmation, type SyncResult } from './sync-policy';

export interface SyncOptions {
  mode?: 'manual' | 'automatic';
  notify?: boolean;
  overwriteApproved?: boolean;
}

export function createSyncService(options: {
  vault: VaultPort;
  connections: ConnectionService;
  retry(id: string): void;
}) {
  const active = new Map<string, Promise<void>>();
  let disposed = false;

  const { vault, connections } = options;

  async function inspect(id: string): Promise<SyncResult> {
    const connection = connections.get(id);
    const inspection = await inspectDocument(vault, connection);

    return requiresOverwriteConfirmation(inspection.output, inspection.existing, connection.last_output_hash)
      ? 'conflict'
      : inspection.status;
  }

  async function generate(id: string, request: SyncOptions = {}): Promise<SyncResult | 'cancelled' | undefined> {
    const connection = connections.find(id);

    const mayWrite = () =>
      !disposed &&
      connections.find(id) === connection &&
      (request.mode !== 'automatic' || connection?.enabled === true);

    if (!connection || !mayWrite()) return 'cancelled';
    const pending = active.get(id);

    if (pending) {
      if (request.mode === 'automatic') {
        options.retry(id);
        return;
      }

      await pending;
      return generate(id, request);
    }

    let release!: () => void;
    active.set(
      id,
      new Promise<void>(resolve => {
        release = resolve;
      })
    );

    try {
      const inspection = await inspectDocument(vault, connection);
      const existingFile = vault.getAbstractFileByPath(connection.output_path);
      const existing = isVaultFile(existingFile) ? await vault.read(existingFile) : null;

      if (
        requiresOverwriteConfirmation(inspection.output, existing, connection.last_output_hash) &&
        !request.overwriteApproved
      )
        return 'conflict';

      const result = await writeDocument(vault, connection, inspection, mayWrite);

      if (result !== 'cancelled' && mayWrite()) {
        const nextHash = fingerprint(inspection.output);

        if (connection.last_output_hash !== nextHash) {
          connection.last_output_hash = nextHash;
          await connections.persist();
        }
      }

      return result;
    } finally {
      active.delete(id);
      release();
    }
  }

  return {
    inspect,
    generate,

    dispose: () => {
      disposed = true;
    }
  };
}
