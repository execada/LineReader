import type { Line } from '../line/model.ts';
import type { DocumentRecord } from './record.ts';

/** Reading order on one page: top to bottom, then left to right. */
export function readingOrder(a: Line, b: Line): number {
  return a.quad[0].y - b.quad[0].y || a.quad[0].x - b.quad[0].x;
}

/** All lines of the document in reading order, page after page. */
export function linesInOrder(doc: DocumentRecord): Line[] {
  return doc.pages.flatMap((p) => [...p.lines].sort(readingOrder));
}

/** The whole recognized text, one line per line, for copying and sharing. */
export function documentText(doc: DocumentRecord): string {
  return linesInOrder(doc)
    .map((l) => l.text.trim())
    .filter((t) => t.length > 0)
    .join('\n');
}

/** The saved translation as plain text, paragraphs apart by an empty line; empty when there is none. */
export function translationText(doc: DocumentRecord): string {
  return (doc.translation?.paragraphs ?? [])
    .map((p) => p.translated.trim())
    .filter((t) => t.length > 0)
    .join('\n\n');
}
