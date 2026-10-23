const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUiHarness } = require('./helpers/obsidian-ui.cjs');

for (const declarative of [true, false]) {
  test(`${declarative ? 'declarative' : 'legacy'} connection settings preserve toggles and confirmed removal`, async () => {
    const ui = createUiHarness();
    const root = ui.createElement();
    const app = {};
    const { getConnectionSettingDefinitions, renderConnectionSettings } = ui.load(
      'features/connections/settings-tab.js'
    );
    let jobs = [
      {
        id: 'report',
        title: 'Project report',
        enabled: false,
        data_path: 'data.json',
        template_path: 'template.md',
        output_path: 'report.md'
      }
    ];
    const saved = [];
    let refreshes = 0;
    const actions = {
      listConnections: () => jobs,
      async saveConnection(connection) {
        saved.push(connection);
      },
      async removeConnection(id) {
        jobs = jobs.filter(connection => connection.id !== id);
      }
    };

    if (declarative) {
      for (const definition of getConnectionSettingDefinitions(app, actions, () => {
        refreshes++;
      })) {
        // Obsidian 1.14 skips custom informational rows without a render callback.
        if (!definition.render) continue;
        const row = ui.createSetting(root).setName(definition.name).setDesc(definition.desc);
        definition.render(row);
      }
    } else {
      renderConnectionSettings(root, app, actions);
    }

    assert.ok(ui.rows.some(row => row.description?.includes('Keep manual edits in the template')));

    const connectionRow = ui.rows.find(row => row.name === 'Project report');
    await connectionRow.controls.find(control => control.kind === 'toggle').change(true);
    assert.equal(saved[0].id, 'report');
    assert.equal(saved[0].enabled, true);
    assert.equal(saved[0].data_path, 'data.json');

    connectionRow.controls.find(control => control.tooltip === 'Remove connection (files are not deleted)').click();
    assert.equal(jobs.length, 1);
    await ui.buttons.find(button => button.buttonText === 'Remove').click();
    assert.equal(jobs.length, 0);
    if (declarative) assert.equal(refreshes, 1);
    else assert.equal(root.children.length, 2);
  });
}
