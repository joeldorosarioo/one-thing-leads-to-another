import { Notice, Setting, type App } from 'obsidian';
import type { EditorActions } from '../../application/plugin-actions';
import type { DocumentConnection } from '../../application/connections/connection-types';
import type { DataField, FieldValue, PortableDocument } from '../../domain/document-types';
import { errorMessage } from '../../shared/error-message';
import { createFieldModal } from './field-modal';

function addValueControl(row: Setting, field: DataField, saveValue: (value: FieldValue) => Promise<void>): void {
  if (field.type === 'boolean') {
    row.addToggle(control => control.setValue(field.value === true).onChange(saveValue));
  } else {
    row.addText(control => {
      control.setPlaceholder(field.type === 'number' ? '0.00' : 'Value').setValue(String(field.value));
      control.inputEl.setAttribute('aria-label', field.label);

      if (field.type === 'number') {
        control.inputEl.type = 'number';
        control.inputEl.step = 'any';
      }

      if (field.type === 'date') control.inputEl.type = 'date';

      control.inputEl.addEventListener('change', () => {
        const raw = control.getValue();

        if (field.type === 'number' && (raw.trim() === '' || !Number.isFinite(Number(raw)))) {
          new Notice('Enter a valid number.');
          control.setValue(String(field.value));
          return;
        }

        void saveValue(field.type === 'number' ? Number(raw) : raw);
      });
    });
  }
}

function filterFieldGroups(page: HTMLElement, search: string): void {
  for (const group of Array.from(page.querySelectorAll<HTMLDetailsElement>('.nts-group'))) {
    let visible = 0;

    for (const item of Array.from(group.querySelectorAll<HTMLElement>('.nts-searchable'))) {
      const matched = (item.dataset.search || '').includes(search);
      item.hidden = !matched;
      if (matched) visible++;
    }

    group.hidden = visible === 0;
    if (search && visible) group.open = true;
  }
}

export function createEditableFields(options: {
  app: App;
  actions: Pick<EditorActions, 'updateValue' | 'saveField'>;
  onValueSaved: (connectionId: string) => Promise<void>;
  onSaveFailed: () => Promise<void>;
  onDelete: (connectionId: string, key: string) => void;
}) {
  const { app, actions, onValueSaved, onSaveFailed, onDelete } = options;

  function render(page: HTMLElement, connection: DocumentConnection, document: PortableDocument): void {
    const searchInput = page.createEl('input', {
      type: 'search',
      placeholder: 'Search fields by name or key...',
      cls: 'nts-search'
    });

    searchInput.setAttribute('aria-label', 'Search fields');
    const grouped = new Map<string, DataField[]>();

    for (const field of document.fields) {
      const section = field.section || 'General';
      const fields = grouped.get(section) || [];

      fields.push(field);
      grouped.set(section, fields);
    }

    for (const [section, fields] of grouped) {
      const group = page.createEl('details', {
        cls: 'nts-group'
      });

      group.open = true;

      group.createEl('summary', {
        text: section,
        cls: 'nts-section'
      });

      const cards = group.createDiv({
        cls: 'nts-field-grid'
      });

      for (const field of fields) renderField(cards, connection.id, field);
    }

    searchInput.addEventListener('input', () => {
      filterFieldGroups(page, searchInput.value.toLocaleLowerCase().trim());
    });

    new Setting(page).addButton(button =>
      button
        .setButtonText('Add field')
        .onClick(() => createFieldModal(app, actions, { connectionId: connection.id, kind: 'field' }).open())
    );
  }

  function renderField(cards: HTMLElement, connectionId: string, field: DataField): void {
    const row = new Setting(cards).setName(field.label);

    row.settingEl.addClass('nts-field', 'nts-searchable');
    row.settingEl.dataset.search = `${field.label} ${field.key}`.toLocaleLowerCase();
    row.nameEl?.setAttribute('title', field.key);

    const commit = async (value: FieldValue): Promise<void> => {
      try {
        await actions.updateValue(connectionId, field.key, value);
        await onValueSaved(connectionId);
      } catch (err) {
        new Notice(`Could not save: ${errorMessage(err)}`, 8000);
        await onSaveFailed();
      }
    };

    addValueControl(row, field, commit);

    row.addExtraButton(button =>
      button
        .setIcon('pencil')
        .setTooltip('Edit field')
        .onClick(() => createFieldModal(app, actions, { connectionId, kind: 'field', field }).open())
    );

    row.addExtraButton(button =>
      button
        .setIcon('trash')
        .setTooltip('Delete field')
        .onClick(() => onDelete(connectionId, field.key))
    );
  }

  return render;
}
