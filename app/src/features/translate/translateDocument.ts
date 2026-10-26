import SverkaTranslate, { type PairStatus } from '../../../modules/sverka-translate/src/index.ts';
import { withTranslation, type DocumentRecord } from '../../entities/document/record.ts';
import { translationTag, type LanguagePair } from './pair.ts';
import { documentParagraphs } from './state.ts';

/** Whether this pair is ready offline, needs a one-time model download or cannot be translated on this phone. */
export function pairStatus(pair: LanguagePair): Promise<PairStatus> {
  return SverkaTranslate.status(translationTag(pair.source), translationTag(pair.target));
}

/**
 * Translates the text paragraph by paragraph on the phone and returns the
 * document with the translation; the caller saves it. The text is not sent anywhere.
 */
export async function translateDocument(doc: DocumentRecord, pair: LanguagePair): Promise<DocumentRecord> {
  const ps = documentParagraphs(doc);
  const out = await SverkaTranslate.translate(
    ps.map((p) => p.text),
    translationTag(pair.source),
    translationTag(pair.target),
  );
  if (out.length !== ps.length || out.some((t) => t.trim() === '')) {
    throw new Error('Перевод вернулся не целиком. Повторите.');
  }
  const next = withTranslation(doc, {
    source: pair.source,
    target: pair.target,
    engine: SverkaTranslate.engine,
    paragraphs: ps.map((p, i) => ({ lineIds: p.lineIds, text: p.text, translated: out[i]! })),
  });
  return next;
}
