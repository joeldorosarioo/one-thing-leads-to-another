import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../src/domain/template-renderer';
import { validateData } from '../../src/domain/data-model';
import type { PortableDocument } from '../../src/domain/document-types';

const data: PortableDocument = {
  schema_version: 1,
  locale: 'en-US',
  currency: 'USD',

  fields: [
    {
      key: 'count_total',
      label: 'Total',
      section: 'Overview',
      type: 'number',
      tone: 'none',
      value: 8
    },
    {
      key: 'count_done',
      label: 'Done',
      section: 'Overview',
      type: 'number',
      tone: 'none',
      value: 3
    }
  ],

  formulas: [
    {
      key: 'count_pending',
      label: 'Pending',
      expression: 'max(0, count_total - count_done)',
      tone: 'pending'
    }
  ]
};

describe('portable document generation', () => {
  it('evaluates formulas without running arbitrary JavaScript', () => {
    expect(validateData(data).count_pending).toBe(5);
    expect(renderTemplate('Remaining: {{integer:count_pending:pending}}', data)).toContain('>5</span>');
  });

  it('rejects unknown template fields and unsafe expressions', () => {
    expect(() => renderTemplate('{{money:unknown_key}}', data)).toThrow();

    expect(() =>
      validateData({
        ...data,

        formulas: [
          {
            ...data.formulas[0],
            expression: 'process.exit(0)'
          }
        ]
      })
    ).toThrow();
  });
});
