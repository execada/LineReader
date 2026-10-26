import type { Candidate, Line } from './model.ts';

/** Why a line goes to review. */
export type Reason = 'low_confidence' | 'risky_token' | 'candidates_disagree' | 'server_disagrees';

/** Which signals put a line into the review queue. */
export interface Rules {
  /** A line with confidence below this goes to review. */
  readonly confidenceBelow: number;
  /** Whether disagreement between the engine's alternative readings sends a line to review. */
  readonly candidates: boolean;
}

/**
 * Rules for Apple Vision, chosen on the synthetic eval set (docs/quality.md):
 * Vision gives a line only 1.0, 0.5 or 0.3, so anything below 1.0 is doubtful.
 */
export const DEFAULT_RULES: Rules = Object.freeze({
  confidenceBelow: 1,
  candidates: false,
});

/**
 * Rules for Tesseract on Android: its line confidence is the mean over words,
 * from 0 to 1. Below 0.9 queues about a third of the lines and catches about
 * two thirds of the wrong ones on good shots (docs/quality.md).
 */
const TESSERACT_RULES: Rules = Object.freeze({
  confidenceBelow: 0.9,
  candidates: false,
});

/** Review rules for the engine that read the document; unknown engines get the Vision rules. */
export function rulesFor(engine: string): Rules {
  return engine.startsWith('tesseract') ? TESSERACT_RULES : DEFAULT_RULES;
}

// Letters an engine confuses with digits: Latin and Cyrillic O, l/I/i, B, S, Z, З, б.
const CONFUSABLE = /[OoОоlIІiBЗзSsZzб]/u;
const DIGIT = /\p{Nd}/u;
const EDGE_PUNCTUATION = /^[\p{P}]+|[\p{P}]+$/gu;

/** True for one letter an engine may have read instead of a digit. */
export function isConfusable(ch: string): boolean {
  return CONFUSABLE.test(ch);
}

/** Tokens that mix digits with digit-like letters, e.g. "SN-7B0O-1l5I" or "66O0123450". */
export function riskyTokens(text: string): string[] {
  return text
    .split(/\s+/u)
    .map((t) => t.replace(EDGE_PUNCTUATION, ''))
    .filter((t) => DIGIT.test(t) && CONFUSABLE.test(t));
}

// Spacing, dash and quote variants do not change what a person reads.
function comparable(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/gu, '')
    .replace(/[‐‑‒–—―-]/gu, '-')
    .replace(/[«»“”„"'’‘]/gu, '"');
}

/** True when the engine's alternative readings differ from each other. */
export function candidatesDisagree(candidates: readonly Candidate[]): boolean {
  return new Set(candidates.map((c) => comparable(c.text))).size > 1;
}

/** All reasons this line needs a person's look; empty when it does not. */
export function reviewReasons(line: Line, rules: Rules): Reason[] {
  if (line.status !== 'pending') {
    return [];
  }
  const reasons: Reason[] = [];
  if (!Number.isFinite(line.confidence) || line.confidence < rules.confidenceBelow) {
    reasons.push('low_confidence');
  }
  if (riskyTokens(line.text).length > 0) {
    reasons.push('risky_token');
  }
  if (rules.candidates && candidatesDisagree(line.candidates)) {
    reasons.push('candidates_disagree');
  }
  if (line.serverText !== undefined && comparable(line.serverText) !== comparable(line.text)) {
    reasons.push('server_disagrees');
  }
  return reasons;
}
