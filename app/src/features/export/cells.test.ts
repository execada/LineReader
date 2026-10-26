import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../../entities/line/model.ts';
import { linesToCells } from './cells.ts';

const box = (id: string, text: string, x: number, y: number, w = 120, h = 24): Line => ({
  id,
  quad: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
  text,
  confidence: 1,
  candidates: [],
  source: 'device',
  status: 'pending',
});

test('lines side by side become a row, aligned lines a column', () => {
  const cells = linesToCells([
    box('a', 'Блюдо', 40, 10),
    box('b', 'Цена', 400, 12),
    box('c', 'Zupa pomidorowa', 40, 50, 300),
    box('d', '18 zł', 405, 48),
    box('e', 'Pierogi ruskie', 42, 90, 280),
    box('f', '26 zł', 402, 91),
  ]);
  assert.deepEqual(
    cells.map((c) => [c.row, c.col, c.text]),
    [
      [0, 0, 'Блюдо'],
      [0, 1, 'Цена'],
      [1, 0, 'Zupa pomidorowa'],
      [1, 1, '18 zł'],
      [2, 0, 'Pierogi ruskie'],
      [2, 1, '26 zł'],
    ],
  );
});

test('a missing cell leaves its column empty instead of shifting the row', () => {
  const cells = linesToCells([
    box('a', 'A1', 40, 10),
    box('b', 'B1', 300, 10),
    box('c', 'C1', 560, 10),
    box('d', 'A2', 40, 50),
    box('e', 'C2', 562, 50),
  ]);
  assert.deepEqual(
    cells.filter((c) => c.row === 1).map((c) => [c.col, c.text]),
    [
      [0, 'A2'],
      [2, 'C2'],
    ],
  );
});

test('a plain paragraph is one column', () => {
  const cells = linesToCells([box('a', 'Первая строка', 40, 10, 600), box('b', 'вторая строка', 40, 40, 580)]);
  assert.deepEqual(
    cells.map((c) => c.col),
    [0, 0],
  );
});

test('no lines give no cells', () => {
  assert.deepEqual(linesToCells([]), []);
});
