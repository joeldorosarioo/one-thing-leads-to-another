'use strict';

const { test } = require('node:test');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class FakeFile {
  constructor(p) {
    this.path = p;
    this.extension = p.split('.').at(-1);
  }
}

class FakeVault {
  constructor(initial) {
    this.items = new Map(Object.entries(initial));
    this.changed = [];
  }

  getAbstractFileByPath(p) {
    if (this.items.has(p)) return new FakeFile(p);

    if ([...this.items.keys()].some(x => x.startsWith(p + '/')))
      return {
        path: p
      };

    return null;
  }

  async read(file) {
    return this.items.get(file.path);
  }

  async modify(file, value) {
    if (!this.items.has(file.path)) throw new Error('Missing file');

    this.items.set(file.path, value);
    this.changed.push(file.path);
  }

  async create(p, value) {
    if (this.items.has(p)) throw new Error('Exists');

    this.items.set(p, value);
    this.changed.push(p);

    return new FakeFile(p);
  }

  async createFolder(_path) {}
}

function loadService() {
  const file = path.join(root, '.build/application/document-generation/generate-document.js');
  const content = fs.readFileSync(file, 'utf8');

  const module = {
    exports: {}
  };

  vm.runInNewContext(`(function(module,exports,require){${content}\n})`, {
    console
  })(module, module.exports, name =>
    name === 'obsidian'
      ? {
          TFile: FakeFile
        }
      : require(path.resolve(root, '.build/application/document-generation', name))
  );

  return module.exports;
}

test('vault output is only rewritten when needed and missing output is created', async () => {
  const { generateDocument } = loadService();

  const doc = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-data.json'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-template.md'), 'utf8');

  const vault = new FakeVault({
    'custom/a.json': doc,
    'other/template.md': template
  });

  const job = {
    data_path: 'custom/a.json',
    template_path: 'other/template.md',
    output_path: 'unrelated/reports/current.md'
  };

  assert.equal(await generateDocument(vault, job), 'created');
  assert.equal(await generateDocument(vault, job), 'unchanged');

  const next = JSON.parse(doc);

  next.fields.find(x => x.key === 'tasks_done').value = 4;
  vault.items.set('custom/a.json', JSON.stringify(next));

  assert.equal(await generateDocument(vault, job), 'updated');
  assert.match(vault.items.get(job.output_path), /class="nts-pending">1<\/span>/);
});

test('inspection reflects pending and unchanged states without writing the output', async () => {
  const { inspectDocument, generateDocument } = loadService();

  const data = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-data.json'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-template.md'), 'utf8');

  const vault = new FakeVault({
    'a.json': data,
    'template.md': template
  });

  const job = {
    data_path: 'a.json',
    template_path: 'template.md',
    output_path: 'reports/generated.md'
  };

  assert.equal((await inspectDocument(vault, job)).status, 'created');
  assert.equal(vault.items.has(job.output_path), false);
  assert.equal(await generateDocument(vault, job), 'created');
  assert.equal((await inspectDocument(vault, job)).status, 'unchanged');

  const next = JSON.parse(data);

  next.fields.find(x => x.key === 'tasks_done').value = 4;
  vault.items.set(job.data_path, JSON.stringify(next));

  assert.equal((await inspectDocument(vault, job)).status, 'updated');
  assert.equal(await generateDocument(vault, job), 'updated');
  assert.equal((await inspectDocument(vault, job)).status, 'unchanged');
});

test('an invalid input keeps previously generated document unchanged', async () => {
  const { generateDocument } = loadService();

  const data = JSON.parse(fs.readFileSync(path.join(root, 'examples/connected-notes/sample-data.json'), 'utf8'));
  const template = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-template.md'), 'utf8');

  const vault = new FakeVault({
    'a.json': JSON.stringify(data),
    'b.md': template,
    'c.md': 'Last known good'
  });

  const job = {
    data_path: 'a.json',
    template_path: 'b.md',
    output_path: 'c.md'
  };

  data.fields.find(x => x.key === 'tasks_done').value = 'not a number';
  vault.items.set('a.json', JSON.stringify(data));

  await assert.rejects(generateDocument(vault, job), /finite number/);
  assert.equal(vault.items.get('c.md'), 'Last known good');
});

test('automatic generation may be cancelled immediately before writing', async () => {
  const { generateDocument } = loadService();

  const data = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-data.json'), 'utf8');
  const template = fs.readFileSync(path.join(root, 'examples/connected-notes/sample-template.md'), 'utf8');

  const vault = new FakeVault({
    'a.json': data,
    'template.md': template,
    'output.md': 'keep this version'
  });

  const job = {
    data_path: 'a.json',
    template_path: 'template.md',
    output_path: 'output.md'
  };

  assert.equal(await generateDocument(vault, job, () => false), 'cancelled');
  assert.equal(vault.items.get('output.md'), 'keep this version');
});
