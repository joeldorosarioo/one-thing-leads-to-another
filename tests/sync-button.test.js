const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSyncControls } = require('../.build/features/data-editor/sync-controls');

test('Sync button only enables for pending changes when auto-sync is OFF', async () => {
  const button = {
    disabled: null,
    tooltip: '',

    setDisabled(value) {
      this.disabled = value;
      return this;
    },

    setTooltip(value) {
      this.tooltip = value;
      return this;
    }
  };

  const label = {
    text: '',

    setText(value) {
      this.text = value;
    },

    toggleClass() {},
    removeClass() {}
  };

  let status = 'updated';

  const job = {
    id: 'conn',
    enabled: false
  };

  const controls = createSyncControls({ inspect: async () => status, isAutomatic: () => job.enabled });

  await controls.refresh(job.id, button, label);

  assert.equal(button.disabled, false);
  assert.equal(controls.canSync(), true);
  assert.match(label.text, /Pending changes/);

  status = 'unchanged';
  await controls.refresh(job.id, button, label);

  assert.equal(button.disabled, true);
  assert.equal(controls.canSync(), false);
  assert.match(label.text, /Up to date/);

  status = 'updated';
  job.enabled = true;

  await controls.refresh(job.id, button, label);

  assert.equal(button.disabled, true);
  assert.equal(controls.canSync(), false);
  assert.match(label.text, /Updating automatically/);
});
