import type { FieldValue } from '../../domain/document-types';
import type { ConnectionService } from '../connections/connection-service';
import type { DocumentService, FieldChange, FieldSelection } from './document-service';

export function createDocumentActions(dependencies: {
  documents: DocumentService;
  connections: ConnectionService;
  changed: (id: string, structureChanged?: boolean) => Promise<void>;
}) {
  const { documents, connections, changed } = dependencies;

  async function updateValue(id: string, key: string, value: FieldValue): Promise<void> {
    await documents.updateValue(connections.get(id).data_path, key, value);
    await changed(id);
  }

  async function saveField(id: string, change: FieldChange): Promise<void> {
    await documents.saveField(connections.get(id).data_path, change);
    await changed(id, true);
  }

  async function deleteField(id: string, selection: FieldSelection): Promise<void> {
    await documents.deleteField(connections.get(id).data_path, selection);
    await changed(id, true);
  }

  return {
    updateValue,
    saveField,
    deleteField,
    readSource: async (id: string) => ({ data: await documents.read(connections.get(id).data_path) }),
    readFormats: documents.readFormats
  };
}
