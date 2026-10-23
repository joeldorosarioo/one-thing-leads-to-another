import { Notice, type App } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { EditorActions } from '../../application/plugin-actions';
import { createConfirmModal } from '../../infrastructure/obsidian/ui/confirm-modal';
import { errorMessage } from '../../shared/error-message';

export function createEditorDialogs(app: App, actions: EditorActions, onDeleted: () => Promise<void>) {
  function confirmOverwrite(connection: DocumentConnection): void {
    createConfirmModal(
      app,
      'Overwrite modified report?',
      `The generated note '${connection.output_path}' may contain manual changes. Overwrite them with the template output?`,
      'Overwrite',
      async () => {
        await actions.syncConnection(connection.id, { notify: true, overwriteApproved: true });
      }
    ).open();
  }

  function askDelete(connectionId: string, key: string, isFormula: boolean): void {
    createConfirmModal(
      app,
      'Remove field?',
      `Removing '${key}' may break formulas or template placeholders that reference it. The previous generated report will be kept if rendering fails.`,
      'Delete',
      async () => {
        try {
          await actions.deleteField(connectionId, { key, kind: isFormula ? 'formula' : 'field' });
          await onDeleted();
        } catch (err) {
          new Notice(errorMessage(err), 8000);
        }
      }
    ).open();
  }

  return { confirmOverwrite, askDelete };
}
