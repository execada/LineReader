import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cropBox } from './geometry.ts';

const quad = (x0: number, y0: number, x1: number, y1: number) =>
  [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ] as const;

test('pads the line and keeps whole pixels', () => {
  assert.deepEqual(cropBox(quad(100.4, 50.6, 300.2, 80.1), 1000, 1000), { originX: 94, originY: 44, width: 213, height: 43 });
});

test('clamps to the page and never returns an empty box', () => {
  assert.deepEqual(cropBox(quad(-3, -2, 20, 10), 15, 8), { originX: 0, originY: 0, width: 15, height: 8 });
  assert.deepEqual(cropBox(quad(50, 50, 50, 50), 10, 10).width, 1);
});
