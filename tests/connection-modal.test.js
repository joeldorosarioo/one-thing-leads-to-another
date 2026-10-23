const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUiHarness } = require('./helpers/obsidian-ui.cjs');

function createConnectionDialog(existing = null) {
  const ui = createUiHarness();
  const saves = [];

  const app = {
    vault: {
      getAbstractFileByPath: path => (path === 'existing.md' ? new ui.TFile(path) : null)
    }
  };

  const actions = {
    async readFormats() {
      return {
        locale: 'en-US',
        currency: 'USD'
      };
    },

    validateConnection() {},

    async saveConnection(connection, options) {
      saves.push(JSON.parse(JSON.stringify({ connection, options })));
    }
  };

  const { createConnectionModal } = ui.load('features/connections/connection-modal.js');

  const modal = createConnectionModal(app, actions, existing);

  const control = name => ui.rows.findLast(row => row.name === name).controls[0];
  const button = label => ui.buttons.findLast(item => item.buttonText === label);

  return { ...ui, modal, saves, control, button };
}

test('connection rerender preserves paths and an independently selected currency', async () => {
  const dialog = createConnectionDialog();
  await dialog.modal.onOpen();

  dialog.control('Connection name').change('Project notes');
  dialog.control('Template (.md)').change('template.md');
  dialog.control('Generated note (.md)').change('report.md');
  dialog.control('Locale').change('pt-BR');

  assert.equal(dialog.control('Currency').value, 'BRL');

  dialog.control('Currency').change('USD');
  dialog.control('Locale').change('en-GB');
  await dialog.button('Use existing JSON (advanced)').click();

  assert.equal(dialog.control('Template (.md)').value, 'template.md');
  assert.equal(dialog.control('Generated note (.md)').value, 'report.md');
  assert.equal(dialog.control('Locale').value, 'en-GB');
  assert.equal(dialog.control('Currency').value, 'USD');

  await dialog.button('Create connection').click();
  assert.equal(dialog.saves.length, 1);
  assert.equal(dialog.saves[0].connection.title, 'Project notes');
  assert.deepEqual(dialog.saves[0].options.format, { locale: 'en-GB', currency: 'USD' });
  assert.equal(dialog.modal.closed, true);
});

test('saving a changed output waits for explicit overwrite confirmation', async () => {
  const dialog = createConnectionDialog({
    id: 'test',
    title: 'Notes',
    data_path: 'data.json',
    template_path: 'template.md',
    output_path: 'report.md',
    enabled: true
  });

  await dialog.modal.onOpen();
  dialog.control('Generated note (.md)').change('existing.md');

  await dialog.button('Save connection').click();
  assert.equal(dialog.saves.length, 0);

  await dialog.button('Cancel').click();
  assert.equal(dialog.saves.length, 0);
  assert.notEqual(dialog.modal.closed, true);

  await dialog.button('Save connection').click();
  await dialog.button('Replace').click();
  assert.equal(dialog.saves.length, 1);
  assert.equal(dialog.saves[0].options.overwriteApproved, true);
  assert.equal(dialog.saves[0].connection.output_path, 'existing.md');
});
