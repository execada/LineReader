import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../../entities/line/model.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { summarize } from './summary.ts';

const quad = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 0, y: 5 },
] as const;

function line(id: string, text: string, confidence = 1, status: Line['status'] = 'pending'): Line {
  return { id, quad, text, confidence, candidates: [], source: 'device', status };
}

function doc(id: string, lines: Line[][], languages = ['ru']): DocumentRecord {
  return {
    version: 1,
    id,
    createdAt: 0,
    languages,
    engine: 'vision',
    sentToServer: 0,
    pages: lines.map((l) => ({ image: 'p.jpg', width: 10, height: 10, lines: l })),
  };
}

test('summary takes the first non-empty line as the title', () => {
  const s = summarize(doc('a', [[line('1', '   '), line('2', 'Справка о доходах'), line('3', 'текст')]]));
  assert.equal(s.title, 'Справка о доходах');
});

test('summary cuts a long title at a word boundary', () => {
  const s = summarize(doc('a', [[line('1', 'Очень длинная первая строка документа, которая не помещается в карточку')]]));
  assert.equal(s.title, 'Очень длинная первая строка документа, которая…');
});

test('summary of a document without text has no title', () => {
  assert.equal(summarize(doc('a', [[]])).title, null);
});

test('summary counts lines to check and the checked share over all pages', () => {
  const s = summarize(
    doc('a', [
      [line('1', 'ok'), line('2', 'неуверенно', 0.5)],
      [line('3', 'сверено', 0.5, 'confirmed'), line('4', 'тоже ok')],
    ]),
  );
  assert.equal(s.lines, 4);
  assert.equal(s.toCheck, 1);
  assert.equal(s.checkedShare, 0.75);
});

test('summary lists languages in upper case', () => {
  assert.equal(summarize(doc('a', [[]], ['ru', 'en'])).languages, 'RU + EN');
});
