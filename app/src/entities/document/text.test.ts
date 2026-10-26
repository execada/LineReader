import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../line/model.ts';
import type { DocumentRecord } from './record.ts';
import { documentText, linesInOrder, translationText } from './text.ts';

const at = (id: string, text: string, x: number, y: number): Line => ({
  id,
  quad: [
    { x, y },
    { x: x + 10, y },
    { x: x + 10, y: y + 5 },
    { x, y: y + 5 },
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
  languages: ['ru'],
  engine: 'vision',
  sentToServer: 0,
  pages: pages.map((lines) => ({ image: 'p.jpg', width: 100, height: 100, lines })),
});

test('lines go page by page, top to bottom, then left to right', () => {
  const d = doc([[at('b', 'второй', 0, 20), at('c', 'справа', 50, 0), at('a', 'первый', 0, 0)], [at('d', 'стр. 2', 0, 0)]]);
  assert.deepEqual(
    linesInOrder(d).map((l) => l.text),
    ['первый', 'справа', 'второй', 'стр. 2'],
  );
});

test('document text puts each line on its own line and skips empty lines', () => {
  const d = doc([[at('a', 'Меню', 0, 0), at('b', '  ', 0, 10)], [at('c', 'Zupa 18 zł', 0, 0)]]);
  assert.equal(documentText(d), 'Меню\nZupa 18 zł');
});

test('a document without lines has empty text', () => {
  assert.equal(documentText(doc([[]])), '');
});

test('translation text puts paragraphs apart by an empty line', () => {
  const d: DocumentRecord = {
    ...doc([[at('a', 'Zupa', 0, 0)]]),
    translation: {
      source: 'pl',
      target: 'ru',
      engine: 'x',
      paragraphs: [
        { lineIds: ['a'], text: 'Zupa', translated: 'Суп' },
        { lineIds: ['b'], text: 'Kompot', translated: ' Компот ' },
      ],
    },
  };
  assert.equal(translationText(d), 'Суп\n\nКомпот');
  assert.equal(translationText(doc([[]])), '');
});
