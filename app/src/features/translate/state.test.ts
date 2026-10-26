import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { documentParagraphs, isTranslationCurrent } from './state.ts';

const at = (id: string, text: string, y: number): Line => ({
  id,
  quad: [
    { x: 0, y },
    { x: 100, y },
    { x: 100, y: y + 20 },
    { x: 0, y: y + 20 },
  ],
  text,
  confidence: 1,
  candidates: [],
  source: 'device',
  status: 'pending',
});

const doc = (pages: Line[][]): DocumentRecord => ({
  version: 1,
  id: 'd',
  createdAt: 0,
  languages: ['pl'],
  engine: 'apple-vision',
  sentToServer: 0,
  pages: pages.map((lines) => ({ image: 'p.jpg', width: 100, height: 100, lines })),
});

test('paragraphs never cross a page boundary', () => {
  const d = doc([[at('a', 'koniec strony', 0)], [at('b', 'początek następnej', 0)]]);
  assert.deepEqual(
    documentParagraphs(d).map((p) => p.lineIds),
    [['a'], ['b']],
  );
});

test('a translation is current until the text of a paragraph changes', () => {
  const d = doc([[at('a', 'Zupa', 0)]]);
  const translated: DocumentRecord = {
    ...d,
    translation: { source: 'pl', target: 'ru', engine: 'x', paragraphs: [{ lineIds: ['a'], text: 'Zupa', translated: 'Суп' }] },
  };
  assert.equal(isTranslationCurrent(translated), true);
  assert.equal(isTranslationCurrent(d), false);
  const edited = { ...translated, pages: [{ ...translated.pages[0]!, lines: [at('a', 'Zupa dnia', 0)] }] };
  assert.equal(isTranslationCurrent(edited), false);
});
