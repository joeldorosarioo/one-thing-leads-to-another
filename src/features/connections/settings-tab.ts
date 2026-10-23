import { Setting, type App } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { ConnectionActions } from '../../application/plugin-actions';
import { createConfirmModal } from '../../infrastructure/obsidian/ui/confirm-modal';
import { createConnectionModal } from './connection-modal';

const GENERATED_NOTE_WARNING =
  'The generated note can be overwritten. Keep manual edits in the template, not the generated note.';

export function getConnectionSettingDefinitions(app: App, actions: ConnectionActions, refresh: () => void) {
  return [
    {
      name: 'Document connections',
      desc: 'Each connection links portable JSON data, a Markdown template, and an output note. No fixed folder or file names.',
      aliases: ['Add connection', 'JSON', 'Markdown template'],
      render: (row: Setting): void => {
        row.addButton(button =>
          button
            .setButtonText('Add connection')
            .setCta()
            .onClick(() => createConnectionModal(app, actions).open())
        );
      }
    },
    ...actions.listConnections().map(connection => ({
      name: connection.title,
      desc: `${connection.data_path} → ${connection.output_path}`,
      aliases: ['Automatic updates', 'Edit connection', 'Remove connection', connection.template_path],
      render: (row: Setting): void => renderConnectionControls(row, app, actions, connection, refresh)
    })),
    {
      name: '',
      desc: GENERATED_NOTE_WARNING,
      render: (row: Setting): void => {
        row.setDesc(GENERATED_NOTE_WARNING);
      }
    }
  ];
}

export function renderConnectionSettings(root: HTMLElement, app: App, actions: ConnectionActions): void {
  root.empty();

  const refresh = () => renderConnectionSettings(root, app, actions);
  for (const definition of getConnectionSettingDefinitions(app, actions, refresh)) {
    const row = new Setting(root).setName(definition.name).setDesc(definition.desc);
    definition.render?.(row);
  }
}

function renderConnectionControls(
  row: Setting,
  app: App,
  actions: ConnectionActions,
  connection: DocumentConnection,
  refresh: () => void
): void {
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
    refresh();
  }
}
