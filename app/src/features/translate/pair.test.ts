import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultPair, translationTag } from './pair.ts';

test('text in a foreign language is translated into the phone language', () => {
  assert.deepEqual(defaultPair(['pl'], 'ru'), { source: 'pl', target: 'ru' });
});

test('text in the phone language is translated into English', () => {
  assert.deepEqual(defaultPair(['ru'], 'ru'), { source: 'ru', target: 'en' });
});

test('in a two-language text the language other than the phone one is the source', () => {
  assert.deepEqual(defaultPair(['ru', 'en'], 'ru'), { source: 'en', target: 'ru' });
});

test('English text on an English phone goes into Russian', () => {
  assert.deepEqual(defaultPair(['en'], 'en'), { source: 'en', target: 'ru' });
});

test('translation tags are BCP 47; Chinese is Simplified', () => {
  assert.equal(translationTag('zh'), 'zh-Hans');
  assert.equal(translationTag('pl'), 'pl');
});
