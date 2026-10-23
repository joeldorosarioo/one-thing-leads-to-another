import { createConnectionService, type SaveConnectionOptions } from './connections/connection-service';
import type { DocumentConnection, PluginSettings } from './connections/connection-types';
import { parseSettings } from './connections/connection-types';
import { createDocumentActions } from './document-editing/document-actions';
import { createDocumentService } from './document-editing/document-service';
import type { VaultPort } from './ports/vault-port';
import { createSyncAction } from './synchronization/sync-action';
import { createSyncScheduler } from './synchronization/sync-scheduler';
import { createSyncService } from './synchronization/sync-service';

export function createPluginActions(dependencies: {
  vault: VaultPort;
  savedSettings: unknown;
  saveSettings(settings: PluginSettings): Promise<void>;
  notify(message: string, duration?: number): void;
  refreshEditors(): Promise<void>;
  refreshSync(id: string): Promise<void>;
}) {
  const documents = createDocumentService(dependencies.vault);

  const connections = createConnectionService({
    settings: parseSettings(dependencies.savedSettings),
    vault: dependencies.vault,
    documents,
    saveSettings: dependencies.saveSettings
  });

  let disposed = false;

  const synchronization = createSyncService({
    vault: dependencies.vault,
    connections,
    retry: id => scheduler.schedule(id)
  });

  const scheduler = createSyncScheduler({
    isEnabled: id => connections.find(id)?.enabled ?? false,
    run: id => syncConnection(id, { mode: 'automatic' })
  });

  const syncConnection = createSyncAction({
    synchronization,
    connections,
    isActive: () => !disposed,
    notify: dependencies.notify,
    refreshSync: dependencies.refreshSync
  });

  async function saveConnection(connection: DocumentConnection, options: SaveConnectionOptions = {}): Promise<void> {
    scheduler.cancel(connection.id);
    await connections.save(connection, options);

    if (connections.get(connection.id).enabled) {
      await syncConnection(connection.id, { notify: true, overwriteApproved: options.overwriteApproved });
    }

    await dependencies.refreshEditors();
  }

  async function changed(id: string, structureChanged = false): Promise<void> {
    if (disposed) return;
    scheduler.schedule(id);

    await dependencies.refreshSync(id);
    if (structureChanged) await dependencies.refreshEditors();
  }

  async function removeConnection(id: string): Promise<void> {
    scheduler.cancel(id);
    await connections.remove(id);
    await dependencies.refreshEditors();
  }

  return {
    listConnections: connections.list,
    validateConnection: connections.validate,
    relocateConnections: connections.relocate,
    inspectConnection: synchronization.inspect,
    queueSync: scheduler.schedule,
    saveConnection,
    removeConnection,
    syncConnection,
    ...createDocumentActions({ documents, connections, changed }),
    dispose() {
      disposed = true;
      scheduler.dispose();
      synchronization.dispose();
      documents.dispose();
    }
  };
}

export type PluginActions = ReturnType<typeof createPluginActions>;

export type ConnectionActions = Pick<
  PluginActions,
  'listConnections' | 'validateConnection' | 'saveConnection' | 'removeConnection' | 'readFormats'
>;

export type EditorActions = Pick<
  PluginActions,
  | 'listConnections'
  | 'inspectConnection'
  | 'syncConnection'
  | 'readSource'
  | 'updateValue'
  | 'saveField'
  | 'deleteField'
  | 'validateConnection'
  | 'saveConnection'
  | 'removeConnection'
  | 'readFormats'
>;
