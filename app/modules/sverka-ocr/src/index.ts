import { requireNativeModule } from 'expo';

/** Raw result of the native module; validated by parsePage before use. */
interface NativeOcr {
  readonly engine: string;
  supportedLanguages(): Promise<string[]>;
  /** Marks a folder as excluded from device backups (iOS); a no-op on Android, where backup is off. */
  excludeFromBackup(uri: string): Promise<void>;
  /** languages are engine codes: Vision locales on iOS ("ru-RU"), Tesseract models on Android ("rus"). */
  recognize(uri: string, languages: string[], customWords: string[]): Promise<unknown>;
}

export default requireNativeModule<NativeOcr>('SverkaOcr');
