import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { bestSuggestion, candidateWords, findTypos, fixAll, fixTypo, type Checker } from './typos.ts';

const at = (id: string, text: string, y: number, confidence = 1): Line => ({
  id,
  quad: [
    { x: 0, y },
    { x: 100, y },
    { x: 100, y: y + 20 },
    { x: 0, y: y + 20 },
  ],
  text,
  confidence,
  candidates: [],
  source: 'device',
  status: 'pending',
});

const doc = (lines: Line[], languages = ['ru', 'en']): DocumentRecord => ({
  version: 1,
  id: 'd',
  createdAt: 0,
  languages,
  engine: 'apple-vision',
  sentToServer: 0,
  pages: [{ image: 'p.jpg', width: 100, height: 100, lines }],
});

// A fake dictionary: knows these words, suggests a fix for a few typos.
const KNOWN = new Set(['доход', 'за', 'год', 'moscow', 'russia', 'справка', 'выдана']);
const FIXES: Record<string, string> = { сентябр: 'сентябрь', rusia: 'Russia' };
const checker: Checker = async (words, language) =>
  words
    .filter((w) => !KNOWN.has(w.toLowerCase()))
    .map((w) => ({ word: w, suggestions: FIXES[w.toLowerCase()] ? [FIXES[w.toLowerCase()]!] : [], language }));

test('candidate words skip numbers, codes, short words and abbreviations', () => {
  assert.deepEqual(
    candidateWords('ИНН 6600123450, ООО «Северный Мост», SN-7B0O, e-mail: a@b.ru, до 12.10').map((w) => w.word),
    ['Северный', 'Мост'],
  );
});

test('candidate words keep their position in the line', () => {
  assert.deepEqual(candidateWords('доход за сентябр'), [
    { word: 'доход', start: 0 },
    { word: 'сентябр', start: 9 },
  ]);
});

test('typos are looked up by script: Cyrillic in Russian, Latin in English', async () => {
  const seen: string[] = [];
  const spy: Checker = async (words, language) => {
    seen.push(`${language}:${words.join(',')}`);
    return checker(words, language);
  };
  const typos = await findTypos(doc([at('a', 'доход за сентябр', 0), at('b', 'Moscow, Rusia', 30)]), spy, []);
  assert.deepEqual(seen.sort(), ['en:Moscow,Rusia', 'ru:доход,сентябр']);
  assert.deepEqual(
    typos.map((t) => [t.lineId, t.word, t.start, t.suggestions[0]]),
    [
      ['a', 'сентябр', 9, 'сентябрь'],
      ['b', 'Rusia', 8, 'Russia'],
    ],
  );
});

test('lines still in the review queue are recognition doubts, not typos', async () => {
  const typos = await findTypos(doc([at('a', 'доход за сентябр', 0, 0.5)]), checker, []);
  assert.deepEqual(typos, []);
});

test('words from the personal dictionary are not typos', async () => {
  const typos = await findTypos(doc([at('a', 'доход за сентябр', 0)]), checker, ['Сентябр']);
  assert.deepEqual(typos, []);
});

test('a word in a language the text is not in is not checked', async () => {
  const typos = await findTypos(doc([at('a', 'Moscow, Rusia', 0)], ['ru']), checker, []);
  assert.deepEqual(typos, []);
});

test('fixing a typo replaces only that word and marks the line as corrected by the person', () => {
  const lines = [at('a', 'сентябр и сентябр', 0)];
  const next = fixTypo(lines, { lineId: 'a', page: 0, word: 'сентябр', start: 10, suggestions: [], language: 'ru' }, 'сентябрь');
  assert.equal(next[0]?.text, 'сентябр и сентябрь');
  assert.equal(next[0]?.source, 'user');
  assert.equal(lines[0]?.text, 'сентябр и сентябр');
});

test('fixing all typos of a line goes from the end so earlier positions stay right', () => {
  const lines = [at('a', 'сентябр и октябр', 0)];
  const typo = (word: string, start: number, fix: string) => ({ lineId: 'a', page: 0, word, start, suggestions: [fix], language: 'ru' });
  const next = fixAll(lines, [typo('сентябр', 0, 'сентябрь'), typo('октябр', 10, 'октябрь')]);
  assert.equal(next[0]?.text, 'сентябрь и октябрь');
});

test('typos without a suggestion are left as they are when fixing all', () => {
  const lines = [at('a', 'абырвалг', 0)];
  assert.equal(fixAll(lines, [{ lineId: 'a', page: 0, word: 'абырвалг', start: 0, suggestions: [], language: 'ru' }])[0]?.text, 'абырвалг');
});

test('the best suggestion is the only one closest to the word; ties have none', () => {
  const typo = (word: string, suggestions: string[]) => ({ lineId: 'a', page: 0, word, start: 0, suggestions, language: 'ru' });
  assert.equal(bestSuggestion(typo('Rusia', ['Russia', 'Rush'])), 'Russia');
  assert.equal(bestSuggestion(typo('сентябр', ['сентябри', 'сентябрь', 'сентябре'])), null);
  assert.equal(bestSuggestion(typo('абырвалг', [])), null);
});

test('fixing all leaves typos without a clear best suggestion for the person', () => {
  const lines = [at('a', 'сентябр Rusia', 0)];
  const typo = (word: string, start: number, suggestions: string[]) => ({ lineId: 'a', page: 0, word, start, suggestions, language: 'en' });
  const next = fixAll(lines, [typo('сентябр', 0, ['сентябри', 'сентябрь']), typo('Rusia', 8, ['Russia'])]);
  assert.equal(next[0]?.text, 'сентябр Russia');
});

test('a language the phone cannot check is skipped, the others still find typos', async () => {
  const partial: Checker = async (words, language) => {
    if (language === 'ru') throw new Error('no Russian dictionary');
    return checker(words, language);
  };
  const typos = await findTypos(doc([at('a', 'доход за сентябр', 0), at('b', 'Moscow, Rusia', 30)]), partial, []);
  assert.deepEqual(
    typos.map((t) => t.word),
    ['Rusia'],
  );
});
