import type { DocumentRecord } from '../../entities/document/record.ts';

const fold = (s: string) => s.normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё', 'е');

/** Keeps documents whose text contains every word of the query, in any line and page. */
export function searchDocuments(docs: readonly DocumentRecord[], query: string): DocumentRecord[] {
  const words = fold(query).split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [...docs];
  return docs.filter((d) => {
    const text = fold(d.pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n'));
    return words.every((w) => text.includes(w));
  });
}
