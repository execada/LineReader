import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';

const TITLE_MAX = 48;

/** What the card shows about one saved text. */
export interface DocumentSummary {
  /** First recognized line, cut to fit a card; null when nothing was recognized. */
  readonly title: string | null;
  readonly languages: string;
  readonly lines: number;
  readonly toCheck: number;
  /** Share of lines that need no more checking, from 0 to 1. */
  readonly checkedShare: number;
}

/** Title, languages and review progress of a document for its card. */
export function summarize(doc: DocumentRecord): DocumentSummary {
  const lines = doc.pages.flatMap((p) => p.lines);
  const toCheck = documentQueue(doc).length;
  const first = lines.map((l) => l.text.trim()).find((t) => t.length > 0);
  return {
    title: first === undefined ? null : shorten(first),
    languages: doc.languages.map((l) => l.toUpperCase()).join(' + '),
    lines: lines.length,
    toCheck,
    checkedShare: lines.length === 0 ? 1 : (lines.length - toCheck) / lines.length,
  };
}

function shorten(text: string): string {
  if (text.length <= TITLE_MAX) return text;
  const cut = text.slice(0, TITLE_MAX + 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : text.slice(0, TITLE_MAX)).trimEnd()}…`;
}
