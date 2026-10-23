const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUiHarness } = require('./helpers/obsidian-ui.cjs');

function createEditorFixture() {
  const ui = createUiHarness();

  const connection = {
    id: 'test',
    title: 'Notes',
    data_path: 'data.json',
    template_path: 'template.md',
    output_path: 'report.md',
    enabled: false
  };

  const document = {
    schema_version: 1,
    locale: 'en-US',
    currency: 'USD',

    fields: [
      {
        key: 'count',
        label: 'Count',
        section: 'General',
        type: 'number',
        value: 2
      },
      {
        key: 'ready',
        label: 'Ready',
        section: 'General',
        type: 'boolean',
        value: true
      }
    ],

    formulas: [
      {
        key: 'double',
        label: 'Double',
        expression: 'count * 2'
      }
    ]
  };

  const edits = [];

  const actions = {
    listConnections: () => [connection],

    async readSource() {
      return { data: document };
    },

    async inspectConnection() {
      return 'updated';
    },

    async updateValue(id, key, value) {
      edits.push({ id, key, value });
      document.fields.find(field => field.key === key).value = value;
    }
  };

  const host = { app: {}, contentEl: ui.createElement(), leaf: { detach() {} } };

  const { createEditorController } = ui.load('features/data-editor/editor-view.js');
  const editor = createEditorController(host, actions);

  return { ...ui, editor, actions, host, connection, document, edits };
}

test('editor rejects invalid numbers and refreshes calculated values after edits', async () => {
  const fixture = createEditorFixture();
  await fixture.editor.render();

  const count = fixture.rows.find(row => row.name === 'Count').controls[0];
  count.inputEl.value = '';
  count.inputEl.trigger('change');

  assert.deepEqual(fixture.edits, []);
  assert.equal(count.inputEl.value, '2');
  assert.equal(fixture.notices[0], 'Enter a valid number.');

  count.inputEl.value = '3';
  count.inputEl.trigger('change');

  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fixture.edits, [{ id: 'test', key: 'count', value: 3 }]);

  const formula = fixture.rows.find(row => row.name === 'Double').controls[0];
  assert.equal(formula.inputEl.value, '6');
  assert.equal(formula.disabled, true);

  await fixture.rows.find(row => row.name === 'Ready').controls[0].change(false);
  assert.deepEqual(fixture.edits[1], { id: 'test', key: 'ready', value: false });
  fixture.editor.dispose();
});

test('changing connections discards an earlier pending source read', async () => {
  const fixture = createEditorFixture();
  const secondConnection = { ...fixture.connection, id: 'second', title: 'Second' };
  fixture.actions.listConnections = () => [fixture.connection, secondConnection];

  let finishFirstRead;

  fixture.actions.readSource = id =>
    id === 'test'
      ? new Promise(resolve => {
          finishFirstRead = resolve;
        })
      : Promise.resolve({ data: fixture.document });

  const firstRender = fixture.editor.render();
  const selector = fixture.rows.find(row => row.name === 'Connection').controls[0];

  await selector.change('second');
  finishFirstRead({ data: fixture.document });
  await firstRender;

  assert.equal(fixture.editor.getConnectionId(), 'second');
  assert.equal(fixture.host.contentEl.querySelectorAll('.nts-field').length, 3);
  fixture.editor.dispose();
});
