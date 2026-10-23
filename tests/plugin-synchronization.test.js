const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPlugin, createVault, readExample } = require('./helpers/plugin-runtime.cjs');

test('generation writes the same source snapshot that was inspected', async () => {
  const document = JSON.parse(readExample('sample-data.json'));

  const connection = {
    id: 'snapshot',
    title: 'Snapshot',
    data_path: 'data.json',
    template_path: 'template.md',
    output_path: 'report.md',
    enabled: false
  };

  const vault = createVault({ 'data.json': JSON.stringify(document), 'template.md': '{{integer:tasks_done}}' });

  const plugin = createPlugin({
    vault
  });

  plugin.data = { jobs: [connection] };
  await plugin.onload();

  const read = vault.read;
  let sourceReads = 0;

  vault.read = async file => {
    const content = await read(file);

    if (file.path === 'data.json' && ++sourceReads === 1) {
      document.fields.find(field => field.key === 'tasks_done').value = 4;
      vault.content.set('data.json', JSON.stringify(document));
    }

    return content;
  };

  await plugin.actions.syncConnection(connection.id, {
    notify: false
  });

  assert.equal(vault.content.get('report.md'), '2');
  assert.equal(await plugin.actions.inspectConnection(connection.id), 'updated');

  plugin.onunload();
});

test('auto-sync off preserves the generated note until manual sync, even after editor edits', async () => {
  const dataPath = 'custom/data.json';
  const templatePath = 'custom/template.md';
  const outputPath = 'reports/note.md';

  const vault = createVault({
    [dataPath]: readExample('sample-data.json'),
    [templatePath]: readExample('sample-template.md')
  });

  const plugin = createPlugin({
    vault
  });

  const connection = {
    id: 'manual',
    title: 'Manual only',
    data_path: dataPath,
    template_path: templatePath,
    output_path: outputPath,
    enabled: false
  };

  plugin.data = {
    jobs: [connection]
  };

  await plugin.onload();

  await plugin.actions.syncConnection(connection.id, {
    notify: false
  });

  const original = vault.content.get(outputPath);

  await plugin.actions.updateValue(connection.id, 'tasks_done', 4);
  await new Promise(resolve => setTimeout(resolve, 650));

  assert.equal(vault.content.get(outputPath), original, 'auto-sync off must not touch generated output');
  assert.equal(await plugin.actions.inspectConnection(connection.id), 'updated', 'manual Sync is pending');

  await plugin.actions.syncConnection(connection.id, {
    notify: true
  });

  assert.match(vault.content.get(outputPath), /class="nts-pending">1<\/span>/);
  assert.equal(await plugin.actions.inspectConnection(connection.id), 'unchanged', 'Sync disabled after manual render');

  plugin.onunload();
});

test('disabling auto-sync cancels a scheduled update, re-enabling restores automatic updates', async () => {
  const dataPath = 'custom/data.json';
  const templatePath = 'custom/template.md';
  const outputPath = 'reports/note.md';

  const vault = createVault({
    [dataPath]: readExample('sample-data.json'),
    [templatePath]: readExample('sample-template.md')
  });

  const plugin = createPlugin({
    vault
  });

  const connection = {
    id: 'toggle',
    title: 'Toggle',
    data_path: dataPath,
    template_path: templatePath,
    output_path: outputPath,
    enabled: true
  };

  plugin.data = {
    jobs: [connection]
  };

  await plugin.onload();

  await plugin.actions.syncConnection(connection.id, {
    notify: false
  });

  const previous = vault.content.get(outputPath);

  await plugin.actions.updateValue(connection.id, 'tasks_done', 4); // queues automatic update
  await plugin.actions.saveConnection({ ...connection, enabled: false }, { create: false }); // must cancel
  await new Promise(resolve => setTimeout(resolve, 650));

  assert.equal(vault.content.get(outputPath), previous);
  assert.equal(await plugin.actions.inspectConnection(connection.id), 'updated');

  await plugin.actions.saveConnection({ ...connection, enabled: true }, { create: false });

  assert.match(vault.content.get(outputPath), /class="nts-pending">1<\/span>/);
  assert.equal(await plugin.actions.inspectConnection(connection.id), 'unchanged');

  await plugin.actions.updateValue(connection.id, 'tasks_done', 3);
  await new Promise(resolve => setTimeout(resolve, 650));

  assert.match(vault.content.get(outputPath), /class="nts-pending">2<\/span>/);
  plugin.onunload();
});

test('externally edited output must not be automatically overwritten', async () => {
  const dataPath = 'data/source.json';
  const templatePath = 'templates/document.md';
  const outputPath = 'results/output.md';
  const raw = readExample('sample-data.json');
  const templ = readExample('sample-template.md');

  const vault = createVault({
    [dataPath]: raw,
    [templatePath]: templ,
    [outputPath]: '# My manual edits\n'
  });

  const plugin = createPlugin({
    vault
  });

  const job = {
    id: 'legacy',
    title: 'Old note',
    data_path: dataPath,
    template_path: templatePath,
    output_path: outputPath,
    enabled: true
  };

  plugin.data = {
    jobs: [job]
  };

  await plugin.onload();
  assert.equal(await plugin.actions.inspectConnection('legacy'), 'conflict');

  await plugin.actions.syncConnection('legacy', {
    notify: false,
    mode: 'automatic'
  });

  assert.equal(vault.content.get(outputPath), '# My manual edits\n');

  await plugin.actions.syncConnection('legacy', {
    notify: false,
    mode: 'manual',
    overwriteApproved: true
  });

  assert.match(vault.content.get(outputPath), /My connected notes/);
  assert.equal(await plugin.actions.inspectConnection('legacy'), 'unchanged');
  assert.equal(Boolean(plugin.data.jobs[0].overwrite_approved), false, 'Transient approval must not be persisted');

  plugin.onunload();
});
