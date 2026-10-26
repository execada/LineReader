import { requireNativeModule } from 'expo';

/** A word the spell checker does not know and its best guesses. */
export interface Misspelling {
  readonly word: string;
  readonly suggestions: string[];
}

interface NativeSpell {
  readonly engine: string;
  /** Two-letter languages with a dictionary on this phone. */
  languages(): string[];
  /** Returns only the misspelled words among `words`, each with up to three suggestions. */
  check(words: string[], language: string): Promise<Misspelling[]>;
}

export default requireNativeModule<NativeSpell>('SverkaSpell');
