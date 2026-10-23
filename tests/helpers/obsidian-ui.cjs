const { createBuiltModuleLoader } = require('./built-module.cjs');
const { createUiElement } = require('./ui-element.cjs');

function createUiHarness({ modernButtons = true } = {}) {
  const rows = [];
  const buttons = [];
  const modals = [];
  const notices = [];
  const events = [];

  function createControl(kind) {
    const element = createUiElement(kind === 'button' ? 'button' : 'input');

    const control = {
      kind,
      inputEl: element,
      buttonEl: element,
      classes: element.classes,
      options: new Map()
    };

    for (const property of ['value', 'disabled', 'buttonText', 'placeholder', 'icon', 'tooltip']) {
      const method = `set${property[0].toUpperCase()}${property.slice(1)}`;

      control[method] = value => {
        control[property] = value;
        element[property] = value;
        return control;
      };
    }

    control.getValue = () => element.value;

    control.setCta = () => {
      element.addClass('mod-cta');
      return control;
    };

    if (modernButtons) {
      control.setDestructive = () => {
        element.addClass('mod-destructive');
        return control;
      };
    }

    control.addOption = (value, label) => {
      control.options.set(value, label);
      return control;
    };

    control.onChange = handler => {
      control.change = value => {
        control.setValue(value);
        return handler(value);
      };
      return control;
    };

    control.onClick = handler => {
      control.click = handler;
      return control;
    };

    if (kind === 'button') buttons.push(control);
    return control;
  }

  function Setting(parent) {
    const settingEl = parent.createDiv();

    const row = {
      settingEl,
      nameEl: settingEl.createEl('span'),
      controls: []
    };

    row.setName = name => {
      row.name = name;
      return row;
    };

    row.setDesc = () => row;

    for (const [method, kind] of Object.entries({
      addText: 'text',
      addTextArea: 'textarea',
      addDropdown: 'dropdown',
      addToggle: 'toggle',
      addButton: 'button',
      addExtraButton: 'button'
    })) {
      row[method] = build => {
        const control = createControl(kind);
        row.controls.push(control);
        settingEl.children.push(control.inputEl);

        build(control);
        return row;
      };
    }
    rows.push(row);
    return row;
  }

  function Modal() {
    const modal = {
      titleEl: createUiElement('h2'),
      contentEl: createUiElement(),

      open() {
        return modal.onOpen?.();
      },

      close() {
        modal.closed = true;
        events.push('close');
        modal.onClose?.();
      }
    };

    modals.push(modal);
    return modal;
  }

  function Notice(message) {
    notices.push(String(message));
  }

  function TFile(path) {
    this.path = path;
  }

  function FuzzySuggestModal() {}
  FuzzySuggestModal.prototype.setPlaceholder = function () {};
  FuzzySuggestModal.prototype.open = function () {};

  const load = createBuiltModuleLoader({ Modal, Setting, Notice, TFile, FuzzySuggestModal });
  return { load, rows, buttons, modals, notices, events, TFile, createElement: createUiElement };
}

module.exports = { createUiHarness };
