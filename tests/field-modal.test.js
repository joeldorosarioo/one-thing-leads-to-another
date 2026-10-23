const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUiHarness } = require('./helpers/obsidian-ui.cjs');

test('custom expression metadata on a data field does not turn it into a calculated field', () => {
  const { load, rows } = createUiHarness();
  const { createFieldModal } = load('features/data-editor/field-modal.js');

  const field = {
    key: 'count',
    label: 'Count',
    section: 'General',
    type: 'number',
    value: 4,
    tone: 'none',
    expression: 'custom metadata'
  };

  const modal = createFieldModal({}, {}, { connectionId: 'connection', kind: 'field', field });
  modal.onOpen();

  assert.ok(rows.some(row => row.name === 'Section'));
  assert.ok(rows.some(row => row.name === 'Type'));
  assert.equal(
    rows.some(row => row.name === 'Formula'),
    false
  );
  assert.equal(field.expression, 'custom metadata');
});
