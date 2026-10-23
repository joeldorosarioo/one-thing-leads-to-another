export const DATA_DIRECTORY = 'note-template-sync/data';

export function managedDataPath(connectionId: string): string {
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(connectionId)) {
    throw new Error('Invalid connection identifier.');
  }

  return `${DATA_DIRECTORY}/${connectionId.replace(/_/g, '-').toLowerCase()}.json`;
}
