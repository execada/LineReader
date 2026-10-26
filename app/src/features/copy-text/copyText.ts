import * as Clipboard from 'expo-clipboard';

import type { DocumentRecord } from '../../entities/document/record.ts';
import { documentText, translationText } from '../../entities/document/text.ts';

/** Puts the whole recognized text on the clipboard; returns false when there is nothing to copy. */
export async function copyDocumentText(doc: DocumentRecord): Promise<boolean> {
  const text = documentText(doc);
  if (text.length === 0) return false;
  await Clipboard.setStringAsync(text);
  return true;
}

/** Puts one line on the clipboard. */
export async function copyLine(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/** Puts the saved translation on the clipboard; returns false when there is none. */
export async function copyTranslation(doc: DocumentRecord): Promise<boolean> {
  const text = translationText(doc);
  if (text.length === 0) return false;
  await Clipboard.setStringAsync(text);
  return true;
}
