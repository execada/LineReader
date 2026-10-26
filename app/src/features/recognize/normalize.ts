import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Long side of a stored page; enough for 150 dpi on A4 and keeps files small.
const MAX_PAGE_SIDE = 3000;

/** A page photo saved in the document folder and its size in pixels. */
export interface StoredImage {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Saves an upright, size-limited JPEG of the photo into target and deletes
 * the source if it is a temporary copy in the cache (scanner or picker output).
 */
export async function normalizePage(sourceUri: string, target: File, width?: number, height?: number): Promise<StoredImage> {
  const size = width && height ? { width, height } : await ImageManipulator.manipulate(sourceUri).renderAsync();
  const scale = Math.min(1, MAX_PAGE_SIDE / Math.max(size.width, size.height));
  const context = ImageManipulator.manipulate(sourceUri);
  if (scale < 1) {
    context.resize({ width: Math.round(size.width * scale) });
  }
  const saved = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  new File(saved.uri).moveSync(target);
  const source = new File(sourceUri);
  if (source.exists && source.uri.startsWith(Paths.cache.uri)) {
    source.delete();
  }
  return { uri: target.uri, width: saved.width, height: saved.height };
}
