import { Setting, type App } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import { managedDataPath } from '../../application/connections/data-path';
import { createFilePicker } from '../../infrastructure/obsidian/ui/picker-modal';

export function createConnectionFields(options: {
  app: App;
  connection: DocumentConnection;
  existing: DocumentConnection | null;
  rerender(): Promise<void>;
  onDataSourceChange(): void;
}) {
  const { app, connection, existing, rerender, onDataSourceChange } = options;

  let useExistingData = false;

  return (root: HTMLElement): void => {
    new Setting(root)
      .setName('Connection name')
      .setDesc('Label shown in the editor; does not rename files.')
      .addText(input =>
        input.setValue(connection.title).onChange(value => {
          connection.title = value;
        })
      );

    new Setting(root)
      .setName('Data storage')
      .setDesc('The plugin manages a portable JSON file. Existing connections keep their original data paths.')
      .addButton(button =>
        button.setButtonText(useExistingData ? 'Use managed storage' : 'Use existing JSON (advanced)').onClick(() => {
          useExistingData = !useExistingData;
          if (!useExistingData && !existing) connection.data_path = managedDataPath(connection.id);
          void rerender();
        })
      );

    if (useExistingData) {
      const dataRow = new Setting(root)
        .setName('Existing JSON file')
        .setDesc('Choose a portable data source already in your vault.');

      dataRow.addText(text =>
        text
          .setPlaceholder('folder/my-data.json')
          .setValue(connection.data_path)
          .onChange(value => {
            connection.data_path = value;
          })
      );

      dataRow.addExtraButton(button =>
        button
          .setIcon('folder-open')
          .setTooltip('Choose existing JSON')
          .onClick(() =>
            createFilePicker(app, 'json', path => {
              connection.data_path = path;
              onDataSourceChange();
              void rerender();
            }).open()
          )
      );
    }

    const documentFiles = [
      { key: 'template_path', label: 'Template (.md)', placeholder: 'any_folder/my_template.md' },
      { key: 'output_path', label: 'Generated note (.md)', placeholder: 'any_folder/my_report.md' }
    ] as const;

    for (const { key, label, placeholder } of documentFiles) {
      const row = new Setting(root).setName(label);

      row.addText(text => {
        text
          .setPlaceholder(placeholder)
          .setValue(connection[key])
          .onChange(value => {
            connection[key] = value;
          });
      });

      row.addExtraButton(button =>
        button
          .setIcon('folder-open')
          .setTooltip('Choose an existing file')
          .onClick(() =>
            createFilePicker(app, 'md', path => {
              connection[key] = path;
              void rerender();
            }).open()
          )
      );
    }
  };
}
