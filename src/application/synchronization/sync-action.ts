import type { ConnectionService } from '../connections/connection-service';
import type { createSyncService, SyncOptions } from './sync-service';
import { errorMessage } from '../../shared/error-message';

export function createSyncAction(dependencies: {
  synchronization: ReturnType<typeof createSyncService>;
  connections: ConnectionService;
  isActive: () => boolean;
  notify: (message: string, duration?: number) => void;
  refreshSync: (id: string) => Promise<void>;
}) {
  const { synchronization, connections, isActive, notify, refreshSync } = dependencies;

  async function syncConnection(id: string, options: SyncOptions = {}) {
    try {
      const result = await synchronization.generate(id, options);
      if (!isActive()) return result;
      const title = connections.find(id)?.title ?? id;

      if (options.notify && result === 'conflict') {
        notify(`Connection '${title}': review the existing report before overwriting.`, 7000);
      } else if (options.notify && (result === 'created' || result === 'updated')) {
        notify(`Connection '${title}': document ${result}.`);
      }

      return result;
    } catch (error) {
      if (isActive()) notify(`Note Template Sync: ${errorMessage(error)}`, 8000);
    } finally {
      if (isActive()) await refreshSync(id);
    }
  }

  return syncConnection;
}
