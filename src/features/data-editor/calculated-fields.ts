import { Setting, type App } from 'obsidian';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { EditorActions } from '../../application/plugin-actions';
import type { CalculatedValues, PortableDocument } from '../../domain/document-types';
import { createFieldModal } from './field-modal';

export function createCalculatedFields(options: {
  app: App;
  actions: Pick<EditorActions, 'saveField'>;
  onDelete(connectionId: string, key: string): void;
}) {
  const { app, actions, onDelete } = options;

  function render(
    page: HTMLElement,
    connection: DocumentConnection,
    document: PortableDocument,
    calculated: CalculatedValues
  ): void {
    const formulaGroup = page.createEl('details', {
      cls: 'nts-group'
    });

    formulaGroup.open = true;

    formulaGroup.createEl('summary', {
      text: 'Calculated fields',
      cls: 'nts-section'
    });

    const formulaCards = formulaGroup.createDiv({
      cls: 'nts-field-grid'
    });

    if (!document.formulas.length)
      formulaCards.createEl('p', {
        text: 'Add a formula to derive values from other fields.',
        cls: 'setting-item-description'
      });

    for (const item of document.formulas) {
      const row = new Setting(formulaCards).setName(item.label);

      row.settingEl.addClass('nts-field', 'nts-formula');
      row.settingEl.dataset.formulaKey = item.key;
      row.nameEl?.setAttribute('title', `${item.key} = ${item.expression}`);

      row.addText(control => {
        control.setValue(String(calculated[item.key])).setDisabled(true);
        control.inputEl.setAttribute('aria-label', `Calculated: ${item.label}`);
      });

      row.addExtraButton(button =>
        button
          .setIcon('pencil')
          .setTooltip('Edit formula')
          .onClick(() =>
            createFieldModal(app, actions, {
              connectionId: connection.id,
              kind: 'formula',
              field: item
            }).open()
          )
      );

      row.addExtraButton(button =>
        button
          .setIcon('trash')
          .setTooltip('Delete formula')
          .onClick(() => onDelete(connection.id, item.key))
      );
    }

    new Setting(formulaGroup).addButton(button =>
      button
        .setButtonText('Add calculated field')
        .onClick(() => createFieldModal(app, actions, { connectionId: connection.id, kind: 'formula' }).open())
    );
  }

  return render;
}
