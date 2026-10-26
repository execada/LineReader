import assert from 'node:assert/strict';
import { test } from 'node:test';

import { highlightSegments } from './highlight.ts';

const marked = (text: string) =>
  highlightSegments(text)
    .map((s) => (s.suspicious ? `[${s.text}]` : s.text))
    .join('');

test('marks digit-like letters only inside tokens that also have digits', () => {
  assert.equal(marked('Серийный SN-7B0O-1l5I, Олег'), 'Серийный [S]N-7[B]0[O]-1[l]5[I], Олег');
});

test('marks a Cyrillic О in a number', () => {
  assert.equal(marked('ИНН 66О0123450'), 'ИНН 66[О]0123450');
});

test('a line without risky tokens is one plain segment', () => {
  assert.deepEqual(highlightSegments('Петров Олег Игоревич'), [{ text: 'Петров Олег Игоревич', suspicious: false }]);
});

test('segments always join back into the line', () => {
  const text = '  Code: 0O1l-5S2Z  до 21:30 ';
  assert.equal(
    highlightSegments(text)
      .map((s) => s.text)
      .join(''),
    text,
  );
});
