const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUiHarness } = require('./helpers/obsidian-ui.cjs');

for (const modernButtons of [true, false]) {
  const api = modernButtons ? 'modern' : 'legacy';

  test(`confirmation opens and performs its action with the ${api} button API`, async () => {
    const { load, buttons, events } = createUiHarness({ modernButtons });
    const { createConfirmModal } = load('infrastructure/obsidian/ui/confirm-modal.js');

    const modal = createConfirmModal({}, 'Delete?', 'Remove this field?', 'Delete', () => {
      events.push('action');
    });

    assert.doesNotThrow(() => modal.onOpen());

    const expectedClasses = modernButtons ? ['mod-destructive', 'mod-cta'] : ['mod-warning'];
    assert.deepEqual([...buttons[1].classes], expectedClasses);
    assert.deepEqual(events, []);

    await buttons[1].click();
    assert.deepEqual(events, ['close', 'action']);
  });
}
