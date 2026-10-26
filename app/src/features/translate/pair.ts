/** Which way to translate, in app language ids ("ru", "pl"). */
export interface LanguagePair {
  readonly source: string;
  readonly target: string;
}

/**
 * The first guess for a new text: from the language of the text that is not the
 * phone's into the phone's language; text already in the phone's language goes
 * into English, and English on an English phone into Russian.
 */
export function defaultPair(textLanguages: readonly string[], phoneLanguage: string): LanguagePair {
  const foreign = textLanguages.find((l) => l !== phoneLanguage);
  if (foreign) return { source: foreign, target: phoneLanguage };
  const source = textLanguages[0] ?? phoneLanguage;
  return { source, target: source === 'en' ? 'ru' : 'en' };
}

/** BCP 47 tag the translation engines expect for an app language id. */
export function translationTag(id: string): string {
  return id === 'zh' ? 'zh-Hans' : id;
}

/** Languages offered as translation targets: the recognition languages both engines translate. */
export const TRANSLATION_LANGUAGES: readonly string[] = ['ru', 'en', 'de', 'pl', 'tr', 'ar', 'zh'];
