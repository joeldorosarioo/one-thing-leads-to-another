import { Notice, Setting, TFile, type App, type ExtraButtonComponent } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { EditorActions } from '../../application/plugin-actions';
import { createConnectionModal } from '../connections/connection-modal';

export function createEditorNavigation(options: {
  app: App;
  actions: EditorActions;
  close(): void;
  selectConnection(id: string): Promise<void>;
  syncConnection(connection: DocumentConnection): Promise<void>;
}) {
  const { app, actions, close, selectConnection, syncConnection } = options;

  function renderHeading(page: HTMLElement): void {
    const top = page.createDiv({
      cls: 'nts-heading'
    });

    const intro = top.createDiv({
      cls: 'nts-intro'
    });

    intro.createEl('h2', {
      text: 'Data editor'
    });

    intro.createEl('p', {
      text: 'Edit values and preview your report alongside.'
    });

    const headingActions = top.createDiv({
      cls: 'nts-heading-actions'
    });

    new Setting(headingActions)
      .addButton(button =>
        button
          .setButtonText('New connection')
          .setCta()
          .onClick(() => createConnectionModal(app, actions).open())
      )

      .addExtraButton(button =>
        button
          .setIcon('x')
          .setTooltip('Close data editor')
          .onClick(() => close())
      );
  }

  function renderToolbar(page: HTMLElement, connection: DocumentConnection) {
    let syncButton!: ExtraButtonComponent;

    const toolbar = page.createDiv({
      cls: 'nts-toolbar'
    });

    new Setting(toolbar)
      .setName('Connection')
      .addDropdown(dropdown => {
        for (const item of actions.listConnections()) dropdown.addOption(item.id, item.title);

        dropdown.setValue(connection.id).onChange(async id => {
          await selectConnection(id);
        });
      })
      .addExtraButton(button =>
        button
          .setIcon('settings')
          .setTooltip('Edit connection')
          .onClick(() => createConnectionModal(app, actions, connection).open())
      )
      .addExtraButton(button => {
        syncButton = button
          .setIcon('refresh-cw')
          .setTooltip('Checking for changes\u2026')
          .setDisabled(true)
          .onClick(() => syncConnection(connection));
      });

    const reportActions = page.createDiv({
      cls: 'nts-report-actions'
    });

    const syncStatusEl = reportActions.createEl('span', {
      cls: 'nts-sync-status',
      text: 'Checking report…'
    });

    new Setting(reportActions).addButton(button =>
      button.setButtonText('Open report').onClick(async () => {
        const file = app.vault.getAbstractFileByPath(connection.output_path);
        if (file instanceof TFile) await app.workspace.getLeaf('tab').openFile(file);
        else new Notice('Generate the document first.');
      })
    );

    return { syncButton, syncStatusEl };
  }

  return { renderHeading, renderToolbar };
}
