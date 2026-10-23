import type { PortableDocument } from '../../domain/document-types';
import { isRecord } from '../../shared/value-guards';
import type { ConnectionPaths } from './connection-paths';

export interface DocumentConnection extends ConnectionPaths {
  id: string;
  title: string;
  enabled: boolean;
  last_output_hash?: string;
}

export interface PluginSettings {
  jobs: DocumentConnection[];
}

export type FormatDraft = Pick<PortableDocument, 'locale' | 'currency'>;

function assertConnection(connection: unknown, index: number): asserts connection is DocumentConnection {
  if (
    !isRecord(connection) ||
    typeof connection.id !== 'string' ||
    typeof connection.title !== 'string' ||
    typeof connection.data_path !== 'string' ||
    typeof connection.template_path !== 'string' ||
    typeof connection.output_path !== 'string' ||
    typeof connection.enabled !== 'boolean' ||
    (connection.last_output_hash !== undefined && typeof connection.last_output_hash !== 'string')
  ) {
    throw new Error(`Invalid saved connection at index ${index}.`);
  }
}

export function parseSettings(input: unknown): PluginSettings {
  if (input == null) return { jobs: [] };
  if (!isRecord(input)) throw new Error('Invalid saved settings.');
  if (input.jobs == null) return { jobs: [] };
  if (!Array.isArray(input.jobs)) throw new Error('Invalid saved settings: jobs must be an array.');

  const jobs: unknown[] = input.jobs;

  return {
    jobs: jobs.map((connection, index): DocumentConnection => {
      assertConnection(connection, index);
      return connection;
    })
  };
}
