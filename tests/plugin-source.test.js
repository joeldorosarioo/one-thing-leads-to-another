const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPlugin, createVault, readExample } = require('./helpers/plugin-runtime.cjs');

test('unloading during a source read prevents the pending edit from being saved', async () => {
  const original = readExample('sample-data.json');

  const connection = {
    id: 'pending',
    title: 'Pending',
    data_path: 'data.json',
    template_path: 'template.md',
    output_path: 'report.md',
    enabled: false
  };

  const vault = createVault({ 'data.json': original });

  const plugin = createPlugin({
    vault
  });

  plugin.data = { jobs: [connection] };
  await plugin.onload();

  let releaseRead;
  let signalRead;

  const started = new Promise(resolve => {
    signalRead = resolve;
  });

  vault.read = async () => {
    signalRead();
    return new Promise(resolve => {
      releaseRead = () => resolve(original);
    });
  };

  const pending = plugin.actions.updateValue(connection.id, 'tasks_done', 4);
  await started;

  plugin.onunload();
  releaseRead();

  await pending;
  assert.equal(vault.content.get('data.json'), original);
});

test('source read errors retain messages from strings and foreign error objects', async () => {
  const vault = createVault({ 'data.json': '{}' });

  const plugin = createPlugin({
    vault
  });

  plugin.data = {
    jobs: [
      {
        id: 'source',
        title: 'Source',
        data_path: 'data.json',
        template_path: 'template.md',
        output_path: 'report.md',
        enabled: false
      }
    ]
  };

  await plugin.onload();

  for (const failure of ['Disk unavailable', { message: 'Permission denied' }, null]) {
    vault.read = async () => {
      throw failure;
    };

    const message = failure === null ? 'Unknown error.' : typeof failure === 'string' ? failure : failure.message;
    await assert.rejects(
      () => plugin.actions.readSource('source'),
      error => error.message === `Invalid JSON: ${message}`
    );
  }
});

test('reading legacy documents supplies missing formulas and preserves custom JSON data', async () => {
  const original = {
    schema_version: 1,
    locale: 'en-US',
    currency: 'USD',
    metadata: { owner: 'author' },

    fields: [
      {
        key: 'ready',
        label: 'Ready',
        section: 'General',
        type: 'boolean',
        value: true
      }
    ]
  };

  const vault = createVault({ 'data.json': JSON.stringify(original) });

  const plugin = createPlugin({
    vault
  });

  plugin.data = {
    jobs: [
      {
        id: 'source',
        title: 'Source',
        data_path: 'data.json',
        template_path: 'template.md',
        output_path: 'report.md',
        enabled: false
      }
    ]
  };

  await plugin.onload();
  const { data } = await plugin.actions.readSource('source');

  assert.equal(data.formulas.length, 0);
  assert.equal(data.fields[0].value, true);
  assert.equal(data.metadata.owner, 'author');
  assert.deepEqual(JSON.parse(vault.content.get('data.json')), original);
});
