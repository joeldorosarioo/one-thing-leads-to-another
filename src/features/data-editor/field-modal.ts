import { Modal, Notice, Setting, type App } from 'obsidian';
import type { EditorActions } from '../../application/plugin-actions';
import { checkKey, isColorRole, isFieldType } from '../../domain/data-model';
import type { CalculatedField, DataField } from '../../domain/document-types';
import { errorMessage } from '../../shared/error-message';

export function createFieldModal(
  app: App,
  actions: Pick<EditorActions, 'saveField'>,

  options: {
    connectionId: string;
    kind: 'field' | 'formula';
    field?: DataField | CalculatedField | null;
  }
): Modal {
  const modal = new Modal(app);
  const field = options.field;
  const isFormula = options.kind === 'formula';
  const draft = createDraft();

  function createDraft(): DataField | CalculatedField {
    if (field) {
      return { ...field };
    }

    if (isFormula) {
      return {
        key: '',
        label: '',
        expression: '',
        tone: 'none'
      };
    }

    return {
      key: '',
      label: '',
      section: 'General',
      type: 'number',
      tone: 'none',
      value: 0
    };
  }

  function render(): void {
    modal.titleEl.setText(`${field ? 'Edit' : 'Add'} ${isFormula ? 'calculated field' : 'field'}`);

    new Setting(modal.contentEl).setName('Key (snake_case)').addText(control =>
      control
        .setValue(draft.key)
        .setDisabled(Boolean(field))
        .onChange(value => {
          draft.key = value.trim();
        })
    );

    new Setting(modal.contentEl).setName('Label').addText(control =>
      control.setValue(draft.label).onChange(value => {
        draft.label = value;
      })
    );

    if (isFormula) {
      if (!('expression' in draft)) throw new Error('A calculated field requires an expression.');

      new Setting(modal.contentEl)
        .setName('Formula')
        .setDesc('Arithmetic, keys, and sum/min/max/round/ceil/floor/abs. No JavaScript.')
        .addTextArea(control =>
          control.setValue(draft.expression).onChange(value => {
            draft.expression = value;
          })
        );
    } else {
      if (!('type' in draft)) throw new Error('A data field requires a type.');

      new Setting(modal.contentEl).setName('Section').addText(control =>
        control.setValue(draft.section).onChange(value => {
          draft.section = value;
        })
      );

      new Setting(modal.contentEl).setName('Type').addDropdown(dropdown => {
        ['number', 'text', 'date', 'boolean'].forEach(item => {
          dropdown.addOption(item, item);
        });

        dropdown
          .setValue(draft.type)
          .setDisabled(Boolean(field))
          .onChange(value => {
            if (isFieldType(value)) {
              draft.type = value;
              draft.value = value === 'number' ? 0 : value === 'boolean' ? false : '';
            }
          });
      });
    }

    if (!field && !isFormula && 'type' in draft)
      new Setting(modal.contentEl).setName('Initial value').addText(control =>
        control.setValue(String(draft.value)).onChange(value => {
          draft.value = draft.type === 'number' ? Number(value) : draft.type === 'boolean' ? value === 'true' : value;
        })
      );

    new Setting(modal.contentEl).setName('Color role').addDropdown(dropdown => {
      ['none', 'income', 'expense', 'investment', 'pending', 'auto'].forEach(item => {
        dropdown.addOption(item, item);
      });

      dropdown.setValue(draft.tone || 'none').onChange(value => {
        if (isColorRole(value)) draft.tone = value;
      });
    });

    new Setting(modal.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => modal.close()))
      .addButton(button =>
        button
          .setButtonText('Save')
          .setCta()
          .onClick(async () => {
            try {
              checkKey(draft.key);

              if (!draft.label.trim()) throw new Error('Label is required.');
              const mode = field ? 'edit' : 'create';

              if (isFormula && 'expression' in draft)
                await actions.saveField(options.connectionId, { kind: 'formula', entity: draft, mode });
              else if ('type' in draft)
                await actions.saveField(options.connectionId, { kind: 'field', entity: draft, mode });

              modal.close();
            } catch (err) {
              new Notice(errorMessage(err), 8000);
            }
          })
      );
  }

  modal.onOpen = render;
  modal.onClose = () => modal.contentEl.empty();

  return modal;
}
