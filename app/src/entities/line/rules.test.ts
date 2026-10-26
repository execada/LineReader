import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reviewReasons, riskyTokens, candidatesDisagree, DEFAULT_RULES, rulesFor } from './rules.ts';
import type { Line } from './model.ts';

const quad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 20 },
  { x: 0, y: 20 },
] as const;

function line(over: Partial<Line> = {}): Line {
  return {
    id: 'l1',
    quad,
    text: 'Акт приёмки',
    confidence: 1,
    candidates: [{ text: 'Акт приёмки', confidence: 1 }],
    source: 'device',
    status: 'pending',
    ...over,
  };
}

test('a confident line with plain words needs no review', () => {
  assert.deepEqual(reviewReasons(line(), DEFAULT_RULES), []);
});

test('confidence below the threshold, or not a number, is a reason', () => {
  assert.deepEqual(reviewReasons(line({ confidence: 0.5 }), DEFAULT_RULES), ['low_confidence']);
  assert.deepEqual(reviewReasons(line({ confidence: Number.NaN }), DEFAULT_RULES), ['low_confidence']);
});

test('risky tokens mix digits with letters that look like digits', () => {
  assert.deepEqual(riskyTokens('Серийный номер SN-7B0O-1l5I — 2 шт.'), ['SN-7B0O-1l5I']);
  assert.deepEqual(riskyTokens('ИНН 66O0123450'), ['66O0123450']);
  assert.deepEqual(riskyTokens('ИНН 6600123450, сумма 184 650,00'), []);
  assert.deepEqual(riskyTokens('XR-2200 и UP-650'), []);
  assert.deepEqual(riskyTokens('счёт № 318 от 02.10.2026'), []);
  assert.deepEqual(riskyTokens('code A1B2'), ['A1B2']);
});

test('a risky token is a reason even on a confident line', () => {
  const l = line({ text: 'ИНН 66O0123450' });
  assert.deepEqual(reviewReasons(l, DEFAULT_RULES), ['risky_token']);
});

test('candidates disagree when they differ in more than spacing, dashes or quotes', () => {
  assert.equal(
    candidatesDisagree([
      { text: 'ИНН 6600', confidence: 1 },
      { text: 'ИНН 66O0', confidence: 0.5 },
    ]),
    true,
  );
  assert.equal(
    candidatesDisagree([
      { text: 'a — b', confidence: 1 },
      { text: 'a - b', confidence: 0.5 },
    ]),
    false,
  );
  assert.equal(
    candidatesDisagree([
      { text: '«a»', confidence: 1 },
      { text: '"a"', confidence: 0.5 },
    ]),
    false,
  );
  assert.equal(candidatesDisagree([{ text: 'a', confidence: 1 }]), false);
  assert.equal(candidatesDisagree([]), false);
});

test('candidate disagreement is a reason only when the rule enables it', () => {
  const l = line({
    candidates: [
      { text: 'Акт приёмки', confidence: 1 },
      { text: 'Акт приемки', confidence: 0.5 },
    ],
  });
  assert.deepEqual(reviewReasons(l, { ...DEFAULT_RULES, candidates: false }), []);
  assert.deepEqual(reviewReasons(l, { ...DEFAULT_RULES, candidates: true }), ['candidates_disagree']);
});

test('a server reading that differs from the device is a reason', () => {
  const l = line({ serverText: 'Акт приемки' });
  assert.deepEqual(reviewReasons(l, DEFAULT_RULES), ['server_disagrees']);
  assert.deepEqual(reviewReasons(line({ serverText: 'Акт  приёмки ' }), DEFAULT_RULES), []);
});

test('reviewed lines never come back', () => {
  for (const status of ['confirmed', 'edited', 'skipped'] as const) {
    assert.deepEqual(reviewReasons(line({ status, confidence: 0.3, text: 'SN-7B0O' }), DEFAULT_RULES), []);
  }
});

test('rules follow the engine: Vision lines below 1.0, Tesseract lines below 0.9', () => {
  assert.equal(rulesFor('apple-vision').confidenceBelow, 1);
  assert.equal(rulesFor('tesseract4android-4.9.0').confidenceBelow, 0.9);
  assert.equal(rulesFor('something-new'), DEFAULT_RULES);
});
