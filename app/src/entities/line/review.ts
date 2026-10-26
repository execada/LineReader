import type { Line } from './model.ts';
import { reviewReasons, type Reason, type Rules } from './rules.ts';

/** A line in the review queue and why it is there. */
export interface ReviewItem {
  readonly line: Line;
  readonly reasons: readonly Reason[];
}

/** The server's reading of one crop; the id is the line id. */
export interface ServerReading {
  readonly id: string;
  readonly text: string;
  readonly confidence: number;
}

/** Lines that need a person's look, top to bottom, then left to right. */
export function reviewQueue(lines: readonly Line[], rules: Rules): ReviewItem[] {
  return lines
    .map((line) => ({ line, reasons: reviewReasons(line, rules) }))
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => a.line.quad[0].y - b.line.quad[0].y || a.line.quad[0].x - b.line.quad[0].x);
}

/** How far the review got: lines the person already decided on and lines still in the queue. */
export function reviewProgress(lines: readonly Line[], rules: Rules): { done: number; left: number } {
  return {
    done: lines.filter((l) => l.status !== 'pending').length,
    left: reviewQueue(lines, rules).length,
  };
}

function update(lines: readonly Line[], id: string, change: (line: Line) => Line): Line[] {
  if (!lines.some((l) => l.id === id)) {
    throw new Error(`no line with id ${id}`);
  }
  return lines.map((l) => (l.id === id ? change(l) : l));
}

/** Marks the line as checked by the person; the text stays as read. */
export function confirmLine(lines: readonly Line[], id: string): Line[] {
  return update(lines, id, (l) => ({ ...l, status: 'confirmed' }));
}

/** Replaces the line text with the person's correction. */
export function editLine(lines: readonly Line[], id: string, text: string): Line[] {
  return update(lines, id, (l) => ({
    ...l,
    text,
    status: 'edited',
    source: 'user',
  }));
}

/** Takes the line out of the queue without confirming it. */
export function skipLine(lines: readonly Line[], id: string): Line[] {
  return update(lines, id, (l) => ({ ...l, status: 'skipped' }));
}

/** Lines with the server readings attached and how many of them the server read differently. */
export interface ServerMerge {
  readonly lines: Line[];
  /** Readings for lines that no longer exist, e.g. deleted while the request was in flight. */
  readonly unknownIds: string[];
}

/**
 * Attaches server readings next to device text; disagreement sends a pending
 * line to review. Lines the person already reviewed keep their decision.
 */
export function applyServerReadings(lines: readonly Line[], readings: readonly ServerReading[]): ServerMerge {
  const byId = new Map(readings.map((r) => [r.id, r.text]));
  const known = new Set(lines.map((l) => l.id));
  return {
    lines: lines.map((l) => {
      const text = byId.get(l.id);
      return text === undefined ? l : { ...l, serverText: text };
    }),
    unknownIds: readings.map((r) => r.id).filter((id) => !known.has(id)),
  };
}
