export type Engine = 'ios' | 'android' | 'server';

/** A recognition language and its code in each engine; a missing code means the engine cannot read it. */
export interface Language {
  readonly id: string;
  /** Name in the language itself, as shown in the picker. */
  readonly name: string;
  /** Apple Vision locale; absent when Vision has no on-device model for it. */
  readonly vision?: string;
  /** Tesseract model name, used on Android and on the server. */
  readonly tesseract: string;
}

// The eval set covers ru, en, de, pl, tr, ar, zh; be and kk are installed on the
// server but not measured, so the language matrix marks them "не проверено".
export const LANGUAGES: readonly Language[] = Object.freeze([
  { id: 'ru', name: 'Русский', vision: 'ru-RU', tesseract: 'rus' },
  { id: 'en', name: 'English', vision: 'en-US', tesseract: 'eng' },
  { id: 'de', name: 'Deutsch', vision: 'de-DE', tesseract: 'deu' },
  { id: 'pl', name: 'Polski', vision: 'pl-PL', tesseract: 'pol' },
  { id: 'tr', name: 'Türkçe', vision: 'tr-TR', tesseract: 'tur' },
  { id: 'ar', name: 'العربية', vision: 'ar-SA', tesseract: 'ara' },
  { id: 'zh', name: '简体中文', vision: 'zh-Hans', tesseract: 'chi_sim' },
  { id: 'be', name: 'Беларуская', tesseract: 'bel' },
  { id: 'kk', name: 'Қазақ тілі', tesseract: 'kaz' },
]);

/** The language with this app id, if the app knows it. */
export function languageById(id: string): Language | undefined {
  return LANGUAGES.find((l) => l.id === id);
}

/** Maps app language ids to the codes one engine expects. */
export function engineCodes(ids: readonly string[], engine: Engine): string[] {
  if (ids.length === 0) {
    throw new Error('choose at least one language');
  }
  return ids.map((id) => {
    const lang = languageById(id);
    if (!lang) {
      throw new Error(`unknown language ${id}`);
    }
    if (engine === 'ios') {
      if (!lang.vision) {
        throw new Error(`no on-device model on iOS for ${id}`);
      }
      return lang.vision;
    }
    return lang.tesseract;
  });
}
