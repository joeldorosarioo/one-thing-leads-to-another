const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPlugin, createVault, readExample } = require('./helpers/plugin-runtime.cjs');

test('connection settings persist regional changes in source JSON without changing paths', async () => {
  const dataPath = 'arbitrary_folder/data.json';
  const templatePath = 'arbitrary_folder/template.md';
  const reportPath = 'arbitrary_folder/report.md';

  const vault = createVault({
    [dataPath]: readExample('sample-data.json'),
    [templatePath]: readExample('sample-template.md')
  });

  const plugin = createPlugin({
    vault
  });

  const connection = {
    id: 'regional',
    title: 'Test connection',
    data_path: dataPath,
    template_path: templatePath,
    output_path: reportPath,
    enabled: true
  };

  plugin.data = {
    jobs: [connection]
  };

  await plugin.onload();

  await plugin.actions.saveConnection(
    {
      ...connection
    },
    {
      create: false,
      format: {
        locale: 'pt-BR',
        currency: 'BRL'
      }
    }
  );

  const updated = JSON.parse(vault.content.get(dataPath));

  assert.equal(updated.locale, 'pt-BR');
  assert.equal(updated.currency, 'BRL');
  assert.equal(plugin.actions.listConnections()[0].output_path, reportPath);
  assert.ok(vault.content.get(reportPath));

  await assert.rejects(
    () =>
      plugin.actions.saveConnection(
        {
          ...connection
        },
        {
          create: false,

          format: {
            locale: 'not-a-locale!',
            currency: 'BRL'
          }
        }
      ),
    /Invalid locale or currency/
  );

  assert.equal(JSON.parse(vault.content.get(dataPath)).locale, 'pt-BR');
  plugin.onunload();
});

test('new connection creates a managed JSON data source without requiring a path', async () => {
  const templatePath = 'templates/any-name.md';
  const outputPath = 'results/generated.md';

  const vault = createVault({
    [templatePath]: '# {{text:document_title}}\n'
  });

  const plugin = createPlugin({
    vault
  });

  await plugin.onload();

  const job = {
    id: 'doc_unittest1',
    title: 'Portable notes',
    data_path: '',
    template_path: templatePath,
    output_path: outputPath,
    enabled: false
  };

  await plugin.actions.saveConnection(job, {
    create: true
  });

  const savedConnection = plugin.actions.listConnections()[0];
  assert.equal(savedConnection.data_path, 'note-template-sync/data/doc-unittest1.json');

  const created = JSON.parse(vault.content.get(savedConnection.data_path));
  assert.equal(created.schema_version, 1);
  assert.equal(vault.content.get(outputPath), undefined, 'Disabled auto-sync must not create a generated note');
  assert.equal(plugin.data.jobs[0].data_path, savedConnection.data_path);

  plugin.onunload();
});
