import type { Section } from './privacy.ts';

/**
 * Third-party software and data shipped in the app or used on the server, with
 * licenses. JavaScript packages are the direct dependencies from package.json
 * (checked against node_modules on 19.10.2026); native parts are listed by hand.
 */
export const LICENSES: readonly Section[] = [
  {
    title: 'Распознавание',
    paragraphs: [
      'Tesseract OCR 5.5 — Apache License 2.0. На Android в составе Tesseract4Android 4.9.0 (Apache License 2.0) с Leptonica (лицензия Leptonica, BSD-подобная).',
      'Модели tessdata_best (rus, eng, pol) — Apache License 2.0.',
      'На iPhone — Apple Vision, часть iOS.',
      'Сервер: gosseract (MIT) поверх Tesseract.',
    ],
  },
  {
    title: 'Перевод, сканер и опечатки',
    paragraphs: [
      'Android: ML Kit Translation и сканер документов ML Kit — условия использования ML Kit (Google); проверка правописания — системная.',
      'iPhone: перевод Apple Translation, сканер VisionKit, проверка UITextChecker — части iOS.',
    ],
  },
  {
    title: 'Шрифты',
    paragraphs: ['Golos Text и IBM Plex Mono — SIL Open Font License 1.1.'],
  },
  {
    title: 'Библиотеки',
    paragraphs: [
      'React 19.2.3, React Native 0.86.3, Expo 57 и модули Expo (expo-camera, expo-clipboard, expo-file-system, expo-image-manipulator, expo-image-picker, expo-secure-store, expo-sharing и другие) — MIT.',
      'react-native-gesture-handler, react-native-safe-area-context, react-native-document-scanner-plugin — MIT.',
      '@cantoo/pdf-lib 2.11.1 и @pdf-lib/fontkit 1.1.1 — MIT. zod 4.6.7 — MIT.',
    ],
  },
];
