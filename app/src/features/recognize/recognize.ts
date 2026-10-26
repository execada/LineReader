import { Platform } from 'react-native';

import SverkaOcr from '../../../modules/sverka-ocr/src/index.ts';
import { normalizePage } from './normalize.ts';
import { engineCodes, LANGUAGES, type Language } from '../../entities/language/languages.ts';
import type { SourceImage } from '../../shared/lib/sourceImage.ts';
import { parsePage } from './page.ts';
import { documentDir, pageImage, saveRecord } from '../../entities/document/files.ts';
import { newRecord, withPage, type DocumentRecord } from '../../entities/document/record.ts';

const deviceEngine = () => (Platform.OS === 'ios' ? 'ios' : 'android');

function newId(now: number): string {
  return `${new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-')}_${Math.floor(Math.random() * 1e6)}`;
}

/** Languages the phone can actually read: those with an installed on-device model. */
export async function deviceLanguages(): Promise<Language[]> {
  const installed = new Set(await SverkaOcr.supportedLanguages());
  const engine = deviceEngine();
  return LANGUAGES.filter((l) => {
    const code = engine === 'ios' ? l.vision : l.tesseract;
    return code !== undefined && installed.has(code);
  });
}

/**
 * Copies the photos into a new document folder, recognizes them on the phone
 * and saves the result. Words the person corrected earlier help Vision on iOS.
 */
export async function recognizeNewDocument(
  sources: readonly SourceImage[],
  languageIds: readonly string[],
  dictionary: readonly string[],
  onProgress: (page: number, total: number) => void,
): Promise<DocumentRecord> {
  const now = Date.now();
  const codes = engineCodes(languageIds, deviceEngine());
  let rec = newRecord(newId(now), languageIds, SverkaOcr.engine, now);
  documentDir(rec.id).create({ intermediates: true, idempotent: true });
  try {
    for (const [i, src] of sources.entries()) {
      onProgress(i + 1, sources.length);
      const name = `page-${i}.jpg`;
      const page = await normalizePage(src.uri, pageImage(rec.id, name), src.width, src.height);
      const raw = await SverkaOcr.recognize(page.uri, codes, [...dictionary]);
      const parsed = parsePage(raw, `p${i}`);
      rec = withPage(rec, {
        image: name,
        width: parsed.width,
        height: parsed.height,
        lines: parsed.lines,
      });
    }
    saveRecord(rec);
    return rec;
  } catch (e) {
    documentDir(rec.id).delete();
    throw e;
  }
}
