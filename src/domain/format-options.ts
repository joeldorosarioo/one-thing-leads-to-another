import { FALLBACK_CURRENCIES, LOCALES, POPULAR_CURRENCIES, REGION_CURRENCIES } from './formatting-options-data';

function recommendedCurrency(locale: string): string | null {
  const region = String(locale)
    .split('-')
    .find(part => /^[A-Za-z]{2}$/.test(part) && part.toUpperCase() === part);

  return (REGION_CURRENCIES as Record<string, string>)[region || ''] || null;
}

function currencyCodes(): string[] {
  let available: string[];

  try {
    available = Intl.supportedValuesOf('currency');
  } catch {
    available = FALLBACK_CURRENCIES;
  }

  const currencies = new Set([...available, ...FALLBACK_CURRENCIES]);

  return [
    ...POPULAR_CURRENCIES.filter(code => currencies.has(code)),
    ...[...currencies].filter(code => !POPULAR_CURRENCIES.includes(code)).sort()
  ];
}

function currencyLabel(code: string): string {
  try {
    const names = new Intl.DisplayNames(['en'], {
      type: 'currency'
    });

    const name = names.of(code);
    if (name && name !== code) return `${name} (${code})`;
  } catch {
    return code;
  }

  return code;
}

function availableLocales(current?: string): [string, string][] {
  const options = LOCALES.slice();

  if (current && !options.some(([tag]) => tag === current)) options.push([current, `${current} (existing value)`]);

  return options;
}

function availableCurrencies(current?: string): [string, string][] {
  const codes = currencyCodes();
  if (current && !codes.includes(current)) codes.push(current);
  return codes.map(code => [code, currencyLabel(code)]);
}

function previewFormat(locale: string, currency: string, amount = 1234.56): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
}

export { availableCurrencies, availableLocales, LOCALES, previewFormat, recommendedCurrency };
