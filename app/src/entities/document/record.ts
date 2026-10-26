import { z } from 'zod';

import type { Line } from '../line/model.ts';

// A file or folder name inside the documents folder: no path separators and no leading dot.
const SAFE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/u;
// Line ids name crop files and server regions: the server's region id rule.
const LINE_ID = /^[A-Za-z0-9_-]{1,32}$/u;
// Upper bounds far above any real page; a doc.json beyond them is broken or forged.
const TEXT_MAX = 20_000;
const SHORT_MAX = 64;
const LINES_MAX = 5_000;
const PAGES_MAX = 100;
const text = z.string().max(TEXT_MAX);
const short = z.string().max(SHORT_MAX);
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const candidate = z.object({
  text,
  confidence: z.number().min(0).max(1),
});

const lineSchema = z.object({
  id: z.string().regex(LINE_ID),
  quad: z.tuple([point, point, point, point]),
  text,
  confidence: z.number().min(0).max(1),
  candidates: z.array(candidate).max(10),
  source: z.enum(['device', 'server', 'user']),
  status: z.enum(['pending', 'confirmed', 'edited', 'skipped']),
  serverText: text.optional(),
});

const pageSchema = z.object({
  // A bare file name inside the document folder; never a path.
  image: z.string().regex(SAFE_NAME, 'image must be a file name in the document folder'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  lines: z.array(lineSchema).max(LINES_MAX),
});

const translationSchema = z.object({
  source: short,
  target: short,
  engine: short,
  paragraphs: z.array(z.object({ lineIds: z.array(z.string().regex(LINE_ID)).max(LINES_MAX), text, translated: text })).max(LINES_MAX),
});

const recordSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(SAFE_NAME),
  createdAt: z.number().int().nonnegative(),
  languages: z.array(short).min(1).max(20),
  engine: short,
  sentToServer: z.number().int().nonnegative(),
  pages: z.array(pageSchema).max(PAGES_MAX),
  translation: translationSchema.optional(),
});

/** One page as saved: the photo file name, its size in pixels and the recognized lines. */
export interface StoredPage {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly Line[];
}

/** One translated paragraph: the lines it came from, their text at the time and the translation. */
export interface TranslatedParagraph {
  readonly lineIds: readonly string[];
  readonly text: string;
  readonly translated: string;
}

/** The last translation of the text, in app language ids, made on the phone by `engine`. */
export interface DocumentTranslation {
  readonly source: string;
  readonly target: string;
  readonly engine: string;
  readonly paragraphs: readonly TranslatedParagraph[];
}

/** A saved text: what is written to doc.json, validated on every read. */
export interface DocumentRecord {
  readonly version: 1;
  readonly id: string;
  readonly createdAt: number;
  readonly languages: readonly string[];
  /** Engine that read the pages on the phone, shown in the mode badge. */
  readonly engine: string;
  /** How many line crops the person agreed to send to the server; 0 means fully offline. */
  readonly sentToServer: number;
  readonly pages: readonly StoredPage[];
  readonly translation?: DocumentTranslation;
}

/** An empty document; throws if the id could escape the documents folder. */
export function newRecord(id: string, languages: readonly string[], engine: string, now: number): DocumentRecord {
  if (!SAFE_NAME.test(id)) {
    throw new Error(`bad document id ${id}`);
  }
  return {
    version: 1,
    id,
    createdAt: now,
    languages: [...languages],
    engine,
    sentToServer: 0,
    pages: [],
  };
}

/** Returns a copy of the document with one more page. */
export function withPage(rec: DocumentRecord, page: StoredPage): DocumentRecord {
  return { ...rec, pages: [...rec.pages, page] };
}

/** Returns a copy with the lines of one page replaced; throws for a missing page. */
export function withLines(rec: DocumentRecord, pageIndex: number, lines: readonly Line[]): DocumentRecord {
  if (!rec.pages[pageIndex]) {
    throw new Error(`no page ${pageIndex} in document ${rec.id}`);
  }
  return {
    ...rec,
    pages: rec.pages.map((p, i) => (i === pageIndex ? { ...p, lines: [...lines] } : p)),
  };
}

/** Returns a copy that counts crops sent to the server, for the mode badge. */
export function withServerUse(rec: DocumentRecord, crops: number): DocumentRecord {
  return { ...rec, sentToServer: rec.sentToServer + crops };
}

/** Returns a copy with this translation in place of the previous one. */
export function withTranslation(rec: DocumentRecord, translation: DocumentTranslation): DocumentRecord {
  return { ...rec, translation };
}

export function serializeRecord(rec: DocumentRecord): string {
  return JSON.stringify(rec);
}

/** Reads doc.json and checks it against the schema; throws on anything unexpected. */
export function parseRecord(json: string): DocumentRecord {
  const parsed = recordSchema.parse(JSON.parse(json));
  return parsed as DocumentRecord;
}
