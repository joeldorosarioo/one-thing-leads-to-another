import type { FieldValue, PortableDocument } from './document-types';

export function escapeText(value: FieldValue): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, ' ');
}

export function duration(months: number, long: boolean, locale: string): string {
  if (!Number.isFinite(months) || months < 0) {
    throw new Error('Duration must be a non-negative finite number.');
  }

  const totalMonths = Math.ceil(months);

  const words = /^pt/i.test(locale)
    ? { month: 'mês', months: 'meses', year: 'ano', years: 'anos', and: 'e' }
    : { month: 'month', months: 'months', year: 'year', years: 'years', and: 'and' };

  const monthLabel = (count: number) => `${count} ${count === 1 ? words.month : words.months}`;
  const short = monthLabel(totalMonths);

  if (!long || totalMonths < 12) return short;

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  const yearLabel = `${years} ${years === 1 ? words.year : words.years}`;
  const remainder = remainingMonths ? ` ${words.and} ${monthLabel(remainingMonths)}` : '';

  return `${short} (${yearLabel}${remainder})`;
}

export function createValueFormatter(source: Pick<PortableDocument, 'locale' | 'currency'>) {
  const numberFormat = new Intl.NumberFormat(source.locale, { maximumFractionDigits: 2 });

  const moneyFormat = new Intl.NumberFormat(source.locale, {
    style: 'currency',
    currency: source.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (kind: string, key: string, value: FieldValue): string => {
    if (kind === 'text') return escapeText(value);

    if (kind === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${key} must be boolean.`);
      return String(value);
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Field '${key}' must be numeric for ${kind}.`);
    }

    switch (kind) {
      case 'money':
        return escapeText(moneyFormat.format(value));
      case 'number':
        return escapeText(numberFormat.format(value));
      case 'decimal':
        return escapeText(
          new Intl.NumberFormat(source.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(value)
        );
      case 'integer':
        if (!Number.isInteger(value)) throw new Error(`${key} must be an integer.`);
        return String(value);
      default:
        return escapeText(duration(value, kind === 'duration_long', source.locale));
    }
  };
}
