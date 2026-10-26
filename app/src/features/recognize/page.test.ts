import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePage } from './page.ts';

const raw = {
  width: 1240,
  height: 1754,
  lines: [
    {
      text: 'ИНН 6600123450',
      confidence: 0.5,
      candidates: [
        { text: 'ИНН 6600123450', confidence: 0.5 },
        { text: 'ИНН 66O0123450', confidence: 0.3 },
      ],
      quad: [
        { x: 10, y: 20 },
        { x: 300, y: 22 },
        { x: 300, y: 52 },
        { x: 10, y: 50 },
      ],
    },
    {
      text: '   ',
      confidence: 1,
      candidates: [],
      quad: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    },
  ],
};

test('native output becomes pending device lines with stable ids', () => {
  const page = parsePage(raw, 'p1');
  assert.equal(page.width, 1240);
  assert.equal(page.lines.length, 1, 'blank lines are dropped');
  const [line] = page.lines;
  assert.equal(line?.id, 'p1-0');
  assert.equal(line?.source, 'device');
  assert.equal(line?.status, 'pending');
  assert.equal(line?.candidates.length, 2);
  assert.deepEqual(line?.quad[2], { x: 300, y: 52 });
});

test('malformed native output is an error', () => {
  assert.throws(() => parsePage({ ...raw, width: -1 }, 'p1'));
  assert.throws(() => parsePage({ ...raw, lines: [{ ...raw.lines[0], quad: [] }] }, 'p1'));
  assert.throws(() => parsePage({ ...raw, lines: [{ ...raw.lines[0], confidence: 2 }] }, 'p1'));
  assert.throws(() => parsePage(null, 'p1'));
});
