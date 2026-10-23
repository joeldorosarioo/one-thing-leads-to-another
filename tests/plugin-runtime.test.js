const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPlugin, createVault, readExample, TFile, notices } = require('./helpers/plugin-runtime.cjs');

for (const existing of [false, true]) {
  test(`Obsidian 1.5 opens and focuses the ${existing ? 'existing' : 'new'} sidebar editor`, async () => {
    let expanded = false;
    let active = null;
    const leaf = { async setViewState() {} };
    const plugin = createPlugin({
      vault: createVault({}),
      apiVersion: '1.5.0',
      workspace: {
        getLeavesOfType: () => (existing ? [leaf] : []),
        getRightLeaf: () => leaf,
        rightSplit: {
          expand() {
            expanded = true;
          }
        },
        setActiveLeaf(value, options) {
          active = { value, options };
        }
      }
    });
    await plugin.onload();
    await plugin.editor.open();
    assert.equal(expanded, true);
    assert.equal(active.value, leaf);
    assert.equal(active.options.focus, true);
    plugin.onunload();
  });
}

test('registered settings expose connection names and automatic updates to modern settings search', async () => {
  const plugin = createPlugin({ vault: createVault({}) });
  plugin.data = {
    jobs: [
      {
        id: 'searchable',
        title: 'Project report',
        enabled: false,
        data_path: 'data.json',
        template_path: 'template.md',
        output_path: 'report.md'
      }
    ]
  };
  await plugin.onload();
  assert.equal(typeof plugin.settingTab.getSettingDefinitions, 'function');
  const definitions = plugin.settingTab.getSettingDefinitions();
  assert.ok(definitions.some(item => item.name === 'Document connections'));
  const connection = definitions.find(item => item.name === 'Project report');
  assert.ok(connection);
  assert.ok(connection.aliases.includes('Automatic updates'));
  assert.equal(typeof connection.render, 'function');
  assert.equal(typeof plugin.settingTab.display, 'function');
  plugin.onunload();
});

test('invalid saved connections are rejected without replacing saved settings', async () => {
  const plugin = createPlugin({
    vault: createVault({})
  });

  const saved = { jobs: [{ id: 'broken', title: 'Broken connection', enabled: true }] };
  plugin.data = saved;

  await assert.rejects(() => plugin.onload(), /Invalid saved connection/);
  assert.equal(plugin.data, saved);
});

test('bundled plugin loads, regenerates and handles actual editor mutations', async () => {
  const dataPath = 'arbitrary_source/sample-data.json';
  const templatePath = 'another_place/template.md';
  const reportPath = 'reports/custom_name.md';

  const vault = createVault({
    [dataPath]: readExample('sample-data.json'),
    [templatePath]: readExample('sample-template.md')
  });

  const plugin = createPlugin({
    vault
  });

  plugin.data = {
    jobs: [
      {
        id: 'test',
        title: 'My notes',
        data_path: dataPath,
        template_path: templatePath,
        output_path: reportPath,
        enabled: true
      }
    ]
  };

  await plugin.onload();

  await plugin.actions.syncConnection('test', {
    notify: false
  });

  assert.match(vault.content.get(reportPath), /class="nts-pending">3<\/span>/);
  await plugin.actions.updateValue('test', 'tasks_done', 4);

  await plugin.actions.syncConnection('test', {
    notify: false
  });

  assert.match(vault.content.get(reportPath), /class="nts-pending">1<\/span>/);

  vault.content.set('somewhere_else/sample-data.json', vault.content.get(dataPath));
  vault.content.delete(dataPath);

  await vault.events.get('rename')(new TFile('somewhere_else/sample-data.json'), dataPath);
  assert.equal(plugin.actions.listConnections()[0].data_path, 'somewhere_else/sample-data.json');
  plugin.onunload();
});

test('editor opens in the right sidebar and unchanged sync does not display a notice', async () => {
  const dataPath = 'assets/data.json';
  const templatePath = 'templates/template.md';
  const reportPath = 'reports/output.md';

  const vault = createVault({
    [dataPath]: readExample('sample-data.json'),
    [templatePath]: readExample('sample-template.md')
  });

  let state = null;
  let revealed = false;
  let sidebarRequested = false;

  const leaf = {
    async setViewState(next) {
      state = next;
    }
  };

  const workspace = {
    onLayoutReady() {},

    getLeavesOfType() {
      return [];
    },

    detachLeavesOfType() {},

    getLeaf() {
      throw new Error('Editor should not open in main tabs');
    },

    getRightLeaf(split) {
      sidebarRequested = split === false;
      return leaf;
    },

    revealLeaf(value) {
      revealed = value === leaf;
    }
  };

  const plugin = createPlugin({
    vault,
    workspace
  });

  plugin.data = {
    jobs: [
      {
        id: 'test',
        title: 'Existing user connection',
        data_path: dataPath,
        template_path: templatePath,
        output_path: reportPath,
        enabled: true
      }
    ]
  };

  await plugin.onload();
  await plugin.editor.open();

  assert.equal(sidebarRequested, true);
  assert.equal(state.type, 'note-template-sync-editor');
  assert.equal(revealed, true);
  assert.equal(sidebarRequested, true);

  await plugin.actions.syncConnection('test', {
    notify: false
  });

  notices.length = 0;

  await plugin.actions.syncConnection('test', {
    notify: true
  });

  assert.deepEqual(notices, []);

  await plugin.actions.updateValue('test', 'tasks_done', 4);

  await plugin.actions.syncConnection('test', {
    notify: true
  });

  assert.equal(notices.length, 1);
  assert.match(notices[0], /updated/);

  plugin.onunload();
});
