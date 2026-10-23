import { Modal, Notice, Setting, TFile, type App } from 'obsidian';
import { validateConnection } from '../../application/connections/connection-paths';
import type { DocumentConnection } from '../../application/connections/connection-types';
import { managedDataPath } from '../../application/connections/data-path';
import type { ConnectionActions } from '../../application/plugin-actions';
import { createConfirmModal } from '../../infrastructure/obsidian/ui/confirm-modal';
import { message } from '../../infrastructure/obsidian/ui/message';
import { errorMessage } from '../../shared/error-message';
import { randomId } from '../../shared/identifier';
import { createConnectionFields } from './connection-fields';
import { createRegionalSettings } from './connection-regional-settings';

export function createConnectionModal(
  app: App,
  actions: ConnectionActions,
  existing: DocumentConnection | null = null
): Modal {
  const modal = new Modal(app);
  const id = existing?.id ?? randomId();

  const connection: DocumentConnection = existing
    ? {
        ...existing
      }
    : {
        id,
        title: 'New connection',
        data_path: managedDataPath(id),
        template_path: '',
        output_path: '',
        enabled: true
      };

  const regionalSettings = createRegionalSettings(app, actions.readFormats);

  const renderFields = createConnectionFields({
    app,
    connection,
    existing,
    rerender: render,
    onDataSourceChange: regionalSettings.reset
  });

  async function render(): Promise<void> {
    await regionalSettings.load(connection.data_path);
    const root = modal.contentEl;

    root.empty();
    root.addClass('nts-connection-modal');
    modal.titleEl.setText(existing ? 'Edit connection' : 'Create connection');

    message(
      root,
      'Select a template and output note. Your data is stored automatically as portable JSON in your vault.'
    );

    renderFields(root);
    regionalSettings.render(root);

    new Setting(root).setName('Automatic updates').addToggle(toggle =>
      toggle.setValue(connection.enabled).onChange(value => {
        connection.enabled = value;
      })
    );

    new Setting(root)
      .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
      .addButton(button =>
        button
          .setButtonText(existing ? 'Save connection' : 'Create connection')
          .setCta()
          .onClick(submit)
      );
  }

  async function submit(): Promise<void> {
    try {
      validateConnection(connection);

      if (!connection.title.trim()) throw new Error('Connection name is required.');
      actions.validateConnection(connection);

      regionalSettings.validate();
    } catch (error) {
      new Notice(errorMessage(error));
      return;
    }

    const isExistingOutput = app.vault.getAbstractFileByPath(connection.output_path) instanceof TFile;
    const needsConfirmation = isExistingOutput && (!existing || existing.output_path !== connection.output_path);

    if (needsConfirmation) {
      const description = `The existing file '${connection.output_path}' will be overwritten when you generate the document. Make a backup first.`;

      const confirmation = createConfirmModal(app, 'Replace generated note?', description, 'Replace', () => save(true));
      confirmation.open();
    } else {
      await save();
    }
  }

  async function save(overwriteApproved = false): Promise<void> {
    try {
      await actions.saveConnection(connection, {
        create: !existing,
        format: regionalSettings.getDraft(),
        overwriteApproved
      });

      modal.close();
      new Notice('Connection saved.');
    } catch (error) {
      new Notice(`Could not save connection: ${errorMessage(error)}`, 8000);
    }
  }

  modal.onOpen = render;
  modal.onClose = () => modal.contentEl.empty();
  return modal;
}
