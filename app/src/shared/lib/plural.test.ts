import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lines, pieces } from './plural.ts';

test('Russian plural forms', () => {
  assert.deepEqual([1, 2, 5, 11, 12, 21, 22, 25, 111, 0].map(pieces), [
    '1 кусок',
    '2 куска',
    '5 кусков',
    '11 кусков',
    '12 кусков',
    '21 кусок',
    '22 куска',
    '25 кусков',
    '111 кусков',
    '0 кусков',
  ]);
  assert.equal(lines(3), '3 строки');
});
