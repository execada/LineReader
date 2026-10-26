import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { cropBox } from '../../entities/line/geometry.ts';
import type { Quad } from '../../entities/line/model.ts';

// JPEG keeps a photographed line well under the server's 1 MiB per crop.
const CROP_QUALITY = 0.85;
// Crops are named by line id; anything else could point outside the crops folder.
const CROP_NAME = /^[A-Za-z0-9_-]{1,32}$/u;

/** A JPEG file of one line and its size in pixels. */
export interface Crop {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

/** Every crop meant for the server lives here, so one delete removes them all. */
const cropsDir = () => new Directory(Paths.cache, 'crops');

/** Deletes every crop left from sending; called after each send and at start. */
export function clearCrops(): void {
  const dir = cropsDir();
  if (dir.exists) dir.delete();
}

/** Cuts one line out of the page into the crops folder; the caller clears the folder after sending. */
export async function cropLine(pageUri: string, quad: Quad, pageWidth: number, pageHeight: number, name: string): Promise<Crop> {
  if (!CROP_NAME.test(name)) {
    throw new Error(`bad crop name ${name}`);
  }
  const box = cropBox(quad, pageWidth, pageHeight);
  const ref = await ImageManipulator.manipulate(pageUri).crop(box).renderAsync();
  const saved = await ref.saveAsync({
    format: SaveFormat.JPEG,
    compress: CROP_QUALITY,
  });
  const dir = cropsDir();
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${name}.jpg`);
  new File(saved.uri).moveSync(target, { overwrite: true });
  return { uri: target.uri, width: saved.width, height: saved.height };
}
