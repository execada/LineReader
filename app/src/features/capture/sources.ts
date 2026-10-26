import * as ImagePicker from 'expo-image-picker';
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';

import type { SourceImage } from '../../shared/lib/sourceImage.ts';

/** Pages from the system document scanner, already cut along the sheet edges and straightened; empty if the person cancelled. */
export async function scanDocument(): Promise<SourceImage[]> {
  const res = await DocumentScanner.scanDocument({ responseType: ResponseType.ImageFilePath, croppedImageQuality: 95 });
  if (res.status !== ScanDocumentResponseStatus.Success || !res.scannedImages?.length) return [];
  return res.scannedImages.map((p) => ({ uri: p.startsWith('file://') ? p : `file://${p}` }));
}

/** Photos chosen in the photo library; empty if the person cancelled. */
export async function pickPhotos(): Promise<SourceImage[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
  return res.canceled ? [] : res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** A message for a failed camera or scanner, without technical details. */
export function cameraErrorText(e: unknown): string {
  return e instanceof Error && /permission|denied/i.test(e.message)
    ? 'Нет доступа к камере. Разрешите его в настройках телефона или выберите снимок из фото.'
    : 'Камера недоступна. Выберите снимок из фото.';
}
