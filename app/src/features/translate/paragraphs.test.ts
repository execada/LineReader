import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Line } from '../../entities/line/model.ts';
import { paragraphs } from './paragraphs.ts';

const at = (id: string, text: string, y: number, h = 20): Line => ({
  id,
  quad: [
    { x: 0, y },
    { x: 100, y },
    { x: 100, y: y + h },
    { x: 0, y: y + h },
  ],
  text,
  confidence: 1,
  candidates: [],
  source: 'device',
  status: 'pending',
});

test('close lines join into one paragraph, a wide gap starts a new one', () => {
  const ps = paragraphs([
    at('a', 'Pociąg ruszył o świcie, a za oknem', 0),
    at('b', 'migały pola i stacje.', 30),
    at('c', 'Rozdział czwarty', 120),
  ]);
  assert.deepEqual(
    ps.map((p) => [p.lineIds, p.text]),
    [
      [['a', 'b'], 'Pociąg ruszył o świcie, a za oknem migały pola i stacje.'],
      [['c'], 'Rozdział czwarty'],
    ],
  );
});

test('a hyphen at the end of a line joins the word', () => {
  const ps = paragraphs([at('a', 'распо-', 0), at('b', 'знавание текста', 28)]);
  assert.equal(ps[0]?.text, 'распознавание текста');
});

test('empty lines are skipped and no lines give no paragraphs', () => {
  assert.deepEqual(paragraphs([]), []);
  assert.deepEqual(
    paragraphs([at('a', '  ', 0), at('b', 'Меню', 30)]).map((p) => p.lineIds),
    [['b']],
  );
});

test('lines of a list stay apart: a line that starts with a capital letter starts a new paragraph', () => {
  const ps = paragraphs([at('a', 'Купить хлеб и молоко', 0), at('b', 'Позвонить маме в 19:00', 30), at('c', 'Ключи у соседа', 60)]);
  assert.deepEqual(
    ps.map((p) => p.text),
    ['Купить хлеб и молоко', 'Позвонить маме в 19:00', 'Ключи у соседа'],
  );
});
