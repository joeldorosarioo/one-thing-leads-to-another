import { relocatePath } from '../../shared/path-utils';
import type { DocumentService } from '../document-editing/document-service';
import { createStarterFiles } from '../document-generation/generate-document';
import type { VaultPort } from '../ports/vault-port';
import { validateConnection } from './connection-paths';
import type { DocumentConnection, FormatDraft, PluginSettings } from './connection-types';
import { managedDataPath } from './data-path';

export interface SaveConnectionOptions {
  create?: boolean;
  format?: FormatDraft | null;
  overwriteApproved?: boolean;
}

export interface ConnectionDependencies {
  settings: PluginSettings;
  vault: VaultPort;
  documents: DocumentService;
  saveSettings(settings: PluginSettings): Promise<void>;
}

export function createConnectionService(dependencies: ConnectionDependencies) {
  const { settings, vault, documents, saveSettings } = dependencies;

  let persistence = Promise.resolve();

  const list = () => settings.jobs;
  const find = (id: string) => settings.jobs.find(connection => connection.id === id);

  function get(id: string): DocumentConnection {
    const connection = find(id);
    if (!connection) throw new Error('Connection not found.');
    return connection;
  }

  function persist(): Promise<void> {
    const snapshot: PluginSettings = {
      ...settings,
      jobs: settings.jobs.map(connection => {
        const copy = { ...connection } as DocumentConnection & { overwrite_approved?: unknown };
        delete copy.overwrite_approved;
        return copy;
      })
    };

    persistence = persistence.catch(() => {}).then(() => saveSettings(snapshot));
    return persistence;
  }

  function validate(connection: DocumentConnection): void {
    validateConnection(connection);

    if (!connection.title.trim()) throw new Error('Connection name is required.');

    for (const other of list()) {
      if (other.id === connection.id) continue;

      if (other.output_path === connection.output_path)
        throw new Error('Two document connections cannot write to the same output.');

      if (
        other.output_path === connection.data_path ||
        other.output_path === connection.template_path ||
        connection.output_path === other.data_path ||
        connection.output_path === other.template_path
      ) {
        throw new Error('An output cannot be a source or template of another connection.');
      }
    }
  }

  async function save(draft: DocumentConnection, options: SaveConnectionOptions): Promise<void> {
    const connection = { ...draft } as DocumentConnection & { overwrite_approved?: unknown };
    delete connection.overwrite_approved;

    if (options.create && !connection.data_path) connection.data_path = managedDataPath(connection.id);
    validate(connection);

    const index = list().findIndex(item => item.id === connection.id);

    if (options.create && index >= 0) throw new Error('Connection already exists.');
    if (!options.create && index < 0) throw new Error('Connection no longer exists.');
    if (options.create) await createStarterFiles(vault, connection);
    if (options.format) await documents.updateFormats(connection.data_path, options.format);
    if (options.create) settings.jobs.push(connection);
    else settings.jobs[index] = connection;

    await persist();
  }

  async function remove(id: string): Promise<void> {
    settings.jobs = list().filter(connection => connection.id !== id);
    await persist();
  }

  async function relocate(oldPath: string, newPath: string): Promise<boolean> {
    let changed = false;

    for (const connection of list()) {
      for (const key of ['data_path', 'template_path', 'output_path'] as const) {
        const next = relocatePath(connection[key], oldPath, newPath);

        if (next !== connection[key]) {
          connection[key] = next;
          changed = true;
        }
      }
    }

    if (changed) await persist();
    return changed;
  }

  return {
    list,
    find,
    get,
    validate,
    persist,
    save,
    remove,
    relocate
  };
}

export type ConnectionService = ReturnType<typeof createConnectionService>;
