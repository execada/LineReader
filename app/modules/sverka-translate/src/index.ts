import { requireNativeModule } from 'expo';

/** Whether a language pair can be translated on this phone right now. */
export type PairStatus = 'installed' | 'supported' | 'unsupported' | 'unavailable';

interface NativeTranslate {
  readonly engine: string;
  /** Language codes are BCP 47 tags: "ru", "en", "pl". */
  status(source: string, target: string): Promise<PairStatus>;
  /** Translates each text separately and returns the results in the same order. */
  translate(texts: string[], source: string, target: string): Promise<string[]>;
}

export default requireNativeModule<NativeTranslate>('SverkaTranslate');
