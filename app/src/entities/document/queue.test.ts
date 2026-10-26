import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../line/model.ts';
import { documentQueue } from './queue.ts';
import type { DocumentRecord } from './record.ts';

const line = (id: string, confidence: number, y = 0): Line => ({
  id,
  quad: [
    { x: 0, y },
    { x: 10, y },
    { x: 10, y: y + 5 },
    { x: 0, y: y + 5 },
  ],
  text: id,
  confidence,
  candidates: [],
  source: 'device',
  status: 'pending',
});

const doc = (engine: string, pages: Line[][]): DocumentRecord => ({
  version: 1,
  id: 'd',
  createdAt: 0,
  languages: ['ru'],
  engine,
  sentToServer: 0,
  pages: pages.map((lines) => ({ image: 'p.jpg', width: 10, height: 10, lines })),
});

test('a Tesseract document queues lines below 0.9 and keeps their page', () => {
  const d = doc('tesseract4android-4.9.0', [[line('a', 0.95), line('b', 0.62)], [line('c', 0.89)]]);
  assert.deepEqual(
    documentQueue(d).map((i) => [i.line.id, i.page]),
    [
      ['b', 0],
      ['c', 1],
    ],
  );
});

test('a Vision document queues every line below 1.0', () => {
  const d = doc('apple-vision', [[line('a', 1), line('b', 0.95)]]);
  assert.deepEqual(
    documentQueue(d).map((i) => i.line.id),
    ['b'],
  );
});
