'use strict';

const assert = require('node:assert/strict');

const { test } = require('node:test');

const {
  availableLocales,
  availableCurrencies,
  recommendedCurrency,
  previewFormat
} = require('../.build/domain/format-options');

test('locale options include common BCP 47 tags and preserve an existing custom locale', () => {
  assert.ok(availableLocales('pt-BR').some(([tag, label]) => tag === 'pt-BR' && label.includes('Portuguese')));
  assert.ok(availableLocales('en-NZ').some(([tag]) => tag === 'en-NZ'));
});

test('currency options contain ISO currency codes, not user-entered values', () => {
  const list = availableCurrencies('BRL');
  assert.ok(list.some(([code, label]) => code === 'BRL' && label.includes('BRL')));
  assert.ok(list.some(([code]) => code === 'EUR'));
});

test('locale recommendation is optional and preserves independent currency choice', () => {
  assert.equal(recommendedCurrency('pt-BR'), 'BRL');
  assert.equal(recommendedCurrency('en-US'), 'USD');
  assert.equal(recommendedCurrency('en-GB'), 'GBP');
  assert.equal(recommendedCurrency('pt-XX'), null);
});

test('number preview respects number and currency formatting', () => {
  assert.match(previewFormat('pt-BR', 'BRL'), /1\.234,56/);
  assert.match(previewFormat('en-US', 'USD'), /1,234\.56/);
});
