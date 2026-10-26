import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reviewQueue, reviewProgress, confirmLine, editLine, skipLine, applyServerReadings } from './review.ts';
import { DEFAULT_RULES } from './rules.ts';
import type { Line } from './model.ts';

function at(id: string, y: number, x: number, over: Partial<Line> = {}): Line {
  return {
    id,
    quad: [
      { x, y },
      { x: x + 100, y },
      { x: x + 100, y: y + 20 },
      { x, y: y + 20 },
    ],
    text: `text ${id}`,
    confidence: 1,
    candidates: [],
    source: 'device',
    status: 'pending',
    ...over,
  };
}

const lines: readonly Line[] = Object.freeze([
  at('c', 300, 0, { confidence: 0.5 }),
  at('a', 100, 0),
  at('b', 200, 50, { text: 'ИНН 66O0123450' }),
  at('d', 200, 0, { confidence: 0.3 }),
]);

test('queue lists only lines needing review, in reading order, with reasons', () => {
  const queue = reviewQueue(lines, DEFAULT_RULES);
  assert.deepEqual(
    queue.map((q) => [q.line.id, q.reasons]),
    [
      ['d', ['low_confidence']],
      ['b', ['risky_token']],
      ['c', ['low_confidence']],
    ],
  );
});

test('confirm, edit and skip return a new array and leave the input untouched', () => {
  const confirmed = confirmLine(lines, 'c');
  assert.notEqual(confirmed, lines);
  assert.equal(lines.find((l) => l.id === 'c')?.status, 'pending');
  assert.equal(confirmed.find((l) => l.id === 'c')?.status, 'confirmed');

  const edited = editLine(lines, 'b', 'ИНН 6600123450');
  const b = edited.find((l) => l.id === 'b');
  assert.equal(b?.text, 'ИНН 6600123450');
  assert.equal(b?.status, 'edited');
  assert.equal(b?.source, 'user');

  const skipped = skipLine(lines, 'd');
  assert.equal(skipped.find((l) => l.id === 'd')?.status, 'skipped');
  assert.deepEqual(
    reviewQueue(skipped, DEFAULT_RULES).map((q) => q.line.id),
    ['b', 'c'],
  );
});

test('editing to the same text still counts as a decision by the user', () => {
  const edited = editLine(lines, 'a', 'text a');
  assert.equal(edited.find((l) => l.id === 'a')?.status, 'edited');
});

test('unknown ids are an error, not a silent no-op', () => {
  assert.throws(() => confirmLine(lines, 'zzz'), /zzz/);
  assert.throws(() => editLine(lines, 'zzz', 'x'), /zzz/);
});

test('server readings are attached as a second opinion, the device text stays', () => {
  const { lines: merged, unknownIds } = applyServerReadings(lines, [{ id: 'a', text: 'tekst a', confidence: 0.8 }]);
  assert.deepEqual(unknownIds, []);
  const a = merged.find((l) => l.id === 'a');
  assert.equal(a?.text, 'text a');
  assert.equal(a?.serverText, 'tekst a');
  assert.ok(reviewQueue(merged, DEFAULT_RULES).some((q) => q.line.id === 'a' && q.reasons.includes('server_disagrees')));
  const late = applyServerReadings(lines, [{ id: 'nope', text: 'x', confidence: 1 }]);
  assert.deepEqual(late.unknownIds, ['nope']);
  assert.deepEqual(late.lines, lines);
});

test('progress counts decided lines as done and the queue as left', () => {
  const ls = [
    at('a', 0, 0, { confidence: 0.5 }),
    at('b', 10, 0, { status: 'confirmed', confidence: 0.5 }),
    at('c', 20, 0, { status: 'edited', source: 'user' }),
    at('d', 30, 0),
  ];
  assert.deepEqual(reviewProgress(ls, DEFAULT_RULES), { done: 2, left: 1 });
});
