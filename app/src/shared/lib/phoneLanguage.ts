/** Two-letter language of the phone's locale, e.g. "ru"; Russian when the locale cannot be read. */
export function phoneLanguage(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase() || 'ru';
  } catch {
    return 'ru';
  }
}
