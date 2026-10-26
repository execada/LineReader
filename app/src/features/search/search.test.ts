import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../../entities/line/model.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { searchDocuments } from './search.ts';

const quad = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 0, y: 5 },
] as const;

function line(id: string, text: string, confidence = 1, status: Line['status'] = 'pending'): Line {
  return {
    id,
    quad,
    text,
    confidence,
    candidates: [],
    source: 'device',
    status,
  };
}

function doc(id: string, lines: Line[][], languages = ['ru']): DocumentRecord {
  return {
    version: 1,
    id,
    createdAt: 0,
    languages,
    engine: 'vision',
    sentToServer: 0,
    pages: lines.map((l) => ({
      image: 'p.jpg',
      width: 10,
      height: 10,
      lines: l,
    })),
  };
}

test('search with an empty query keeps every document in order', () => {
  const docs = [doc('a', [[line('1', 'раз')]]), doc('b', [[line('1', 'два')]])];
  assert.deepEqual(
    searchDocuments(docs, '  ').map((d) => d.id),
    ['a', 'b'],
  );
});

test('search finds text on any page, ignoring case and ё', () => {
  const docs = [doc('a', [[line('1', 'Меню')], [line('2', 'Ещё ПИРОГИ')]]), doc('b', [[line('1', 'Справка')]])];
  assert.deepEqual(
    searchDocuments(docs, 'еще пироги').map((d) => d.id),
    ['a'],
  );
});

test('search matches several words in different lines', () => {
  const docs = [doc('a', [[line('1', 'Zupa pomidorowa'), line('2', 'Kompot z wiśni')]]), doc('b', [[line('1', 'Zupa')]])];
  assert.deepEqual(
    searchDocuments(docs, 'zupa kompot').map((d) => d.id),
    ['a'],
  );
});
