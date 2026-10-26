import type { DocumentRecord } from '../../entities/document/record.ts';
import { readingOrder } from '../../entities/document/text.ts';
import { paragraphs, type Paragraph } from './paragraphs.ts';

/** Paragraphs of every page in reading order; a paragraph never spans two pages. */
export function documentParagraphs(doc: DocumentRecord): Paragraph[] {
  return doc.pages.flatMap((p) => paragraphs([...p.lines].sort(readingOrder)));
}

/** True when the saved translation was made from the text as it is now (no edits since). */
export function isTranslationCurrent(doc: DocumentRecord): boolean {
  const saved = doc.translation?.paragraphs;
  if (!saved) return false;
  const now = documentParagraphs(doc);
  return now.length === saved.length && now.every((p, i) => p.text === saved[i]?.text);
}
