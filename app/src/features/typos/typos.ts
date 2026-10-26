import { documentQueue } from '../../entities/document/queue.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import type { Line } from '../../entities/line/model.ts';
import { editLine } from '../../entities/line/review.ts';

/** A word as it stands in the line: its text and where it starts (in UTF-16 units, like String.slice). */
export interface WordAt {
  readonly word: string;
  readonly start: number;
}

/** A word the spell checker does not know, where it is and what it suggests instead. */
export interface Typo extends WordAt {
  readonly lineId: string;
  readonly page: number;
  readonly suggestions: readonly string[];
  readonly language: string;
}

/** Asks the phone's spell checker which of the words are misspelled in this language. */
export type Checker = (words: string[], language: string) => Promise<{ word: string; suggestions: string[] }[]>;

const WORD = /\p{L}+(?:[-'’]\p{L}+)*/gu;
const NOT_PROSE = /[\p{Nd}@/\\_=#]/u;
const MIN_LENGTH = 3;
const ABBREVIATION_MAX = 4;

const SCRIPTS: readonly { test: RegExp; languages: readonly string[] }[] = [
  { test: /\p{Script=Cyrillic}/u, languages: ['ru', 'be', 'kk'] },
  { test: /\p{Script=Latin}/u, languages: ['en', 'de', 'pl', 'tr'] },
  { test: /\p{Script=Arabic}/u, languages: ['ar'] },
];

/**
 * Words worth a spell check: chunks with digits, @, slashes and the like are
 * codes, numbers, addresses or links; words shorter than three letters,
 * all-capital words up to four letters (ИНН, ООО, PDF) and hyphenated words are skipped too.
 */
export function candidateWords(text: string): WordAt[] {
  const out: WordAt[] = [];
  for (const chunk of text.matchAll(/\S+/gu)) {
    if (NOT_PROSE.test(chunk[0])) continue;
    for (const m of chunk[0].matchAll(WORD)) {
      const word = m[0];
      const abbreviation = word.length <= ABBREVIATION_MAX && word === word.toLocaleUpperCase() && word !== word.toLocaleLowerCase();
      // Hyphenated words («из-за», «e-mail») trip system checkers, which check them whole.
      if (word.length >= MIN_LENGTH && !abbreviation && !word.includes('-')) out.push({ word, start: chunk.index + m.index });
    }
  }
  return out;
}

function languagesOf(word: string, textLanguages: readonly string[]): string[] {
  const script = SCRIPTS.find((s) => s.test.test(word));
  return script ? textLanguages.filter((l) => script.languages.includes(l)) : [];
}

/**
 * Typos in the lines nobody doubts: lines still in the review queue may hold
 * recognition errors and are left to review. A word is a typo when it is
 * misspelled in every language of the text written in its script and is not
 * in the personal dictionary.
 */
export async function findTypos(doc: DocumentRecord, check: Checker, dictionary: readonly string[]): Promise<Typo[]> {
  const queued = new Set(documentQueue(doc).map((i) => i.line.id));
  const known = new Set(dictionary.map((w) => w.toLocaleLowerCase()));
  const words = doc.pages.flatMap((p, page) =>
    p.lines
      .filter((l) => !queued.has(l.id))
      .flatMap((l) => candidateWords(l.text).map((w) => ({ ...w, lineId: l.id, page, languages: languagesOf(w.word, doc.languages) }))),
  );
  const toCheck = words.filter((w) => w.languages.length > 0 && !known.has(w.word.toLocaleLowerCase()));
  const verdicts = new Map<string, Map<string, string[]>>();
  for (const language of [...new Set(toCheck.flatMap((w) => w.languages))]) {
    const unique = [...new Set(toCheck.filter((w) => w.languages.includes(language)).map((w) => w.word))];
    // A language the phone cannot check is skipped; the other languages still count.
    const wrong = await check(unique, language).catch(() => null);
    if (wrong) verdicts.set(language, new Map(wrong.map((m) => [m.word, m.suggestions])));
  }
  return toCheck
    .filter((w) => w.languages.some((l) => verdicts.has(l)) && w.languages.every((l) => !verdicts.has(l) || verdicts.get(l)!.has(w.word)))
    .map((w) => ({
      lineId: w.lineId,
      page: w.page,
      word: w.word,
      start: w.start,
      language: w.languages.find((l) => verdicts.has(l))!,
      suggestions: verdicts.get(w.languages.find((l) => verdicts.has(l))!)?.get(w.word) ?? [],
    }));
}

/** Replaces the typo with the chosen word; the line counts as corrected by the person. */
export function fixTypo(lines: readonly Line[], typo: Typo, replacement: string): Line[] {
  const line = lines.find((l) => l.id === typo.lineId);
  if (!line || line.text.slice(typo.start, typo.start + typo.word.length) !== typo.word) {
    throw new Error(`typo ${typo.word} is no longer in line ${typo.lineId}`);
  }
  return editLine(lines, line.id, line.text.slice(0, typo.start) + replacement + line.text.slice(typo.start + typo.word.length));
}

function distance(a: string, b: string): number {
  const x = [...a.toLocaleLowerCase()];
  const y = [...b.toLocaleLowerCase()];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const curr = [i];
    for (let j = 1; j <= y.length; j++) {
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[y.length]!;
}

/**
 * The suggestion to offer first: the one closest to the word, if no other is
 * as close. «сентябр» is one letter from «сентябрь», «сентябре» and «сентябри»
 * alike, so the person chooses; the checker's own order is not trusted.
 */
export function bestSuggestion(typo: Typo): string | null {
  const scored = typo.suggestions.map((s) => ({ s, d: distance(typo.word, s) }));
  const min = Math.min(...scored.map((x) => x.d));
  const closest = scored.filter((x) => x.d === min);
  return closest.length === 1 ? closest[0]!.s : null;
}

/** Applies the best suggestion of every typo that has a clear one, last in the line first, so positions stay right. */
export function fixAll(lines: readonly Line[], typos: readonly Typo[]): Line[] {
  return typos
    .map((t) => ({ t, best: bestSuggestion(t) }))
    .filter((x): x is { t: Typo; best: string } => x.best !== null)
    .sort((a, b) => b.t.start - a.t.start)
    .reduce<Line[]>((acc, x) => fixTypo(acc, x.t, x.best), [...lines]);
}
