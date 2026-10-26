import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LANGUAGES, engineCodes, languageById } from './languages.ts';

test('every language has a Tesseract model and unique id', () => {
  const ids = LANGUAGES.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of LANGUAGES) {
    assert.match(l.tesseract, /^[a-z_]+$/);
  }
});

test('engine codes follow the platform', () => {
  assert.deepEqual(engineCodes(['ru', 'en'], 'ios'), ['ru-RU', 'en-US']);
  assert.deepEqual(engineCodes(['ru', 'en'], 'android'), ['rus', 'eng']);
  assert.deepEqual(engineCodes(['ru', 'en'], 'server'), ['rus', 'eng']);
});

test('a language without an on-device model on iOS is reported, not silently dropped', () => {
  assert.equal(languageById('kk')?.vision, undefined);
  assert.throws(() => engineCodes(['kk'], 'ios'), /kk/);
  assert.deepEqual(engineCodes(['kk'], 'server'), ['kaz']);
});

test('unknown ids are rejected', () => {
  assert.throws(() => engineCodes(['xx'], 'server'), /xx/);
  assert.throws(() => engineCodes([], 'server'), /at least one/);
});
