import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addShots, CAPTURE_MODES, MAX_SHOTS } from './shots.ts';

test('shots are added in order without changing the old list', () => {
  const first = [{ uri: 'file:///a.jpg' }];
  const next = addShots(first, [{ uri: 'file:///b.jpg' }, { uri: 'file:///c.jpg' }]);
  assert.deepEqual(
    next.shots.map((s) => s.uri),
    ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'],
  );
  assert.equal(first.length, 1);
  assert.equal(next.dropped, 0);
});

test('shots over the limit are dropped and counted', () => {
  const full = Array.from({ length: MAX_SHOTS - 1 }, (_, i) => ({ uri: `file:///${i}.jpg` }));
  const next = addShots(full, [{ uri: 'file:///x.jpg' }, { uri: 'file:///y.jpg' }]);
  assert.equal(next.shots.length, MAX_SHOTS);
  assert.equal(next.shots.at(-1)?.uri, 'file:///x.jpg');
  assert.equal(next.dropped, 1);
});

test('only document mode straightens the page with the system scanner', () => {
  assert.deepEqual(
    CAPTURE_MODES.map((m) => [m.id, m.straighten]),
    [
      ['text', false],
      ['document', true],
      ['book', false],
    ],
  );
});
