import { Directory, File, Paths } from 'expo-file-system';

import SverkaOcr from '../../../modules/sverka-ocr/src/index.ts';
import type { Line } from '../line/model.ts';
import { parseRecord, serializeRecord, withLines, type DocumentRecord } from './record.ts';

// Documents live in the app sandbox: <documents>/documents/<id>/{doc.json, page-N.jpg};
// the personal dictionary in <documents>/meta. Both folders are excluded from
// iCloud/iTunes backup; Android backup is off in app.json.
const root = () => new Directory(Paths.document, 'documents');
const metaDir = () => new Directory(Paths.document, 'meta');

// A folder without doc.json older than this is a recognition that was interrupted.
const ORPHAN_AGE_MS = 10 * 60 * 1000;

/** Folder of one document: its doc.json and page photos. */
export function documentDir(id: string): Directory {
  return new Directory(root(), id);
}

/** Creates the documents and dictionary folders once and keeps them out of device backups. */
export async function prepareStorage(): Promise<void> {
  for (const dir of [root(), metaDir()]) {
    dir.create({ intermediates: true, idempotent: true });
    await SverkaOcr.excludeFromBackup(dir.uri);
  }
}

function writeText(file: File, text: string): void {
  file.create({ intermediates: true, overwrite: true });
  file.write(text);
}

/** Writes doc.json atomically: a temporary file first, then a move over the old one. */
export function saveRecord(rec: DocumentRecord): void {
  const dir = documentDir(rec.id);
  dir.create({ intermediates: true, idempotent: true });
  const tmp = new File(dir, 'doc.json.tmp');
  writeText(tmp, serializeRecord(rec));
  tmp.moveSync(new File(dir, 'doc.json'), { overwrite: true });
}

async function loadRecord(id: string): Promise<DocumentRecord> {
  const rec = parseRecord(await new File(documentDir(id), 'doc.json').text());
  if (rec.id !== id) {
    throw new Error(`doc.json in ${id} names another document`);
  }
  return rec;
}

/**
 * All readable documents, newest first. Folders of interrupted recognitions
 * are removed; folders with an unreadable doc.json are reported, not hidden.
 */
export async function listRecords(now: number): Promise<{ records: DocumentRecord[]; broken: string[] }> {
  const dir = root();
  if (!dir.exists) {
    return { records: [], broken: [] };
  }
  const records: DocumentRecord[] = [];
  const broken: string[] = [];
  for (const entry of dir.list()) {
    if (!(entry instanceof Directory)) continue;
    const json = new File(entry, 'doc.json');
    if (!json.exists) {
      const created = entry.info().creationTime ?? 0;
      if (now - created > ORPHAN_AGE_MS) entry.delete();
      continue;
    }
    try {
      records.push(await loadRecord(entry.name));
    } catch {
      broken.push(entry.name);
    }
  }
  return { records: records.sort((a, b) => b.createdAt - a.createdAt), broken };
}

/** Removes the document folder with its photos and text. */
export function deleteDocument(id: string): void {
  const dir = documentDir(id);
  if (dir.exists) {
    dir.delete();
  }
}

/** Photo of one page inside the document folder. */
export function pageImage(id: string, name: string): File {
  return new File(documentDir(id), name);
}

const dictionaryFile = () => new File(metaDir(), 'dictionary.json');

/** Words learned from corrections; an unreadable file starts an empty list. */
export async function loadDictionary(): Promise<string[]> {
  const file = dictionaryFile();
  if (!file.exists) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === 'string') : [];
  } catch {
    return [];
  }
}

/** Saves the personal dictionary of words learned from corrections. */
export function saveDictionary(words: readonly string[]): void {
  writeText(dictionaryFile(), JSON.stringify(words));
}

/** A cache file for an export, deleted after sharing. */
export function exportFile(name: string, content: string | Uint8Array): File {
  const file = new File(Paths.cache, 'exports', name);
  file.create({ intermediates: true, overwrite: true });
  file.write(content);
  return file;
}

/** Replaces the lines of one page and saves the document at once. */
export function updateLines(rec: DocumentRecord, page: number, lines: readonly Line[]): DocumentRecord {
  const next = withLines(rec, page, lines);
  saveRecord(next);
  return next;
}
