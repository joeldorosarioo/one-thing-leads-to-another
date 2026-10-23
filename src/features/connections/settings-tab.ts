import { Setting, type App } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { ConnectionActions } from '../../application/plugin-actions';
import { createConfirmModal } from '../../infrastructure/obsidian/ui/confirm-modal';
import { createConnectionModal } from './connection-modal';

export function renderConnectionSettings(root: HTMLElement, app: App, actions: ConnectionActions): void {
  root.empty();

  renderHeader();

  for (const connection of actions.listConnections()) {
    renderConnectionRow(connection);
  }

  root.createEl('p', {
    text: 'The generated note can be overwritten. Keep manual edits in the template, not the generated note.',
    cls: 'setting-item-description'
  });

  function renderHeader(): void {
    new Setting(root)
      .setName('Document connections')
      .setDesc(
        'Each connection links portable JSON data, a Markdown template, and an output note. No fixed folder or file names.'
      )
      .addButton(button => button.setButtonText('Add connection').setCta().onClick(addConnection));
  }

  function addConnection(): void {
    createConnectionModal(app, actions).open();
  }

  function renderConnectionRow(connection: DocumentConnection): void {
    const row = new Setting(root)
      .setName(connection.title)
      .setDesc(`${connection.data_path} → ${connection.output_path}`);

    row.addToggle(control => control.setValue(connection.enabled).onChange(setAutomaticSync));
    row.addExtraButton(button => button.setIcon('pencil').setTooltip('Edit connection').onClick(editConnection));

    row.addExtraButton(button =>
      button.setIcon('trash').setTooltip('Remove connection (files are not deleted)').onClick(confirmRemoval)
    );

    async function setAutomaticSync(enabled: boolean): Promise<void> {
      await actions.saveConnection({ ...connection, enabled });
    }

    function editConnection(): void {
      createConnectionModal(app, actions, connection).open();
    }

    function confirmRemoval(): void {
      const description = `Remove '${connection.title}'? The data, template and output files will be kept.`;
      createConfirmModal(app, 'Remove connection?', description, 'Remove', removeConnection).open();
    }

    async function removeConnection(): Promise<void> {
      await actions.removeConnection(connection.id);
      renderConnectionSettings(root, app, actions);
    }
  }
}
