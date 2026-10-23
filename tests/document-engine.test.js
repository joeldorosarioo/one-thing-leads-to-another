'use strict';

const { test } = require('node:test');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderTemplate } = require('../.build/domain/template-renderer');
const { validateData, blankDocument } = require('../.build/domain/data-model');
const { computeValues, evaluateExpression } = require('../.build/domain/expression-engine');
const { relocatePath } = require('../.build/shared/path-utils');
const { validateConnection } = require('../.build/application/connections/connection-paths');

const root = path.join(__dirname, '../examples/connected-notes');
const data = JSON.parse(fs.readFileSync(path.join(root, 'sample-data.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'sample-template.md'), 'utf8');

test('connected notes example produces correct values', () => {
  const values = validateData(data);

  assert.equal(values.tasks_total, 5);
  assert.equal(values.tasks_done, 2);
  assert.equal(values.tasks_remaining, 3);
});

test('generated Markdown contains no placeholders or editable properties', () => {
  const report = renderTemplate(template, data);

  assert.match(report, /My connected notes/);
  assert.match(report, /class="nts-pending">3<\/span>/);
  assert.doesNotMatch(report, /\{\{[\s\S]*?\}\}/);
  assert.doesNotMatch(report, /^---\n/);
  assert.doesNotMatch(report, /(?:INPUT\[|VIEW\[)/);
});

test('changing source updates calculated notes', () => {
  const next = structuredClone(data);
  next.fields.find(f => f.key === 'tasks_done').value = 4;

  const report = renderTemplate(template, next);
  assert.match(report, /Tasks completed: 4/);
  assert.match(report, /class="nts-pending">1<\/span>/);
});

test('dynamic color roles are applied to pending and negative values', () => {
  const next = structuredClone(data);

  next.fields.find(f => f.key === 'tasks_done').value = 5;
  assert.match(renderTemplate(template, next), /class="nts-success">0<\/span>/);

  const negative = structuredClone(data);

  negative.formulas.push({
    key: 'difference',
    label: 'Difference',
    expression: 'tasks_done - tasks_total',
    tone: 'auto'
  });

  assert.match(renderTemplate('{{integer:difference:auto}}', negative), /class="nts-expense">-3<\/span>/);
});

test('formulas reject invalid expressions', () => {
  assert.throws(() => evaluateExpression('process.exit()', () => 0), /Unexpected|Unsupported/);
  assert.throws(() => evaluateExpression('1 / 0', () => 0), /non-finite/);
  assert.throws(() => computeValues({ a: 1 }, { b: 'c+1', c: 'b+2' }), /Circular/);
  assert.equal(
    evaluateExpression('sum(1,2,3) + round(0.125,2)', () => 0),
    6.13
  );
});

test('malformed sources are rejected', () => {
  const next = structuredClone(data);

  next.fields.push({ ...next.fields[0] });
  assert.throws(() => renderTemplate(template, next), /Duplicate/);
  assert.throws(() => renderTemplate('Value {{money:missing}}', data), /Unknown template field/);

  const invalid = structuredClone(data);

  invalid.formulas.find(f => f.key === 'tasks_remaining').expression = 'unknown + 1';
  assert.throws(() => validateData(invalid), /Unknown field/);
});

test('supports general text and booleans', () => {
  const doc = blankDocument();

  doc.fields.push({
    key: 'is_ready',
    label: 'Ready',
    section: 'General',
    type: 'boolean',
    value: true
  });

  doc.fields.push({
    key: 'quantity',
    label: 'Quantity',
    section: 'General',
    type: 'number',
    value: 1234.5
  });

  const result = renderTemplate('# {{text:document_title}}\n{{boolean:is_ready}} {{money:quantity:income}}', doc);

  assert.match(result, /# My document/);
  assert.match(result, /true/);
  assert.match(result, /\$1,234\.50/);
});

test('paths are vault relative and support moves', () => {
  assert.equal(
    validateConnection({
      data_path: 'a/data.json',
      template_path: 'b/template.md',
      output_path: 'c/report.md'
    }).output_path,
    'c/report.md'
  );

  assert.equal(relocatePath('Finance/2026/values.json', 'Finance', 'Budget'), 'Budget/2026/values.json');

  assert.throws(
    () =>
      validateConnection({
        data_path: '../x.json',
        template_path: 'a.md',
        output_path: 'b.md'
      }),
    /not allowed/
  );

  assert.throws(
    () =>
      validateConnection({
        data_path: 'a.json',
        template_path: 'a.md',
        output_path: 'a.md'
      }),
    /different/
  );
});
