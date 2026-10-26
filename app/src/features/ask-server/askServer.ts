import { File } from 'expo-file-system';

import { pageImage, saveRecord } from '../../entities/document/files.ts';
import { withLines, withServerUse, type DocumentRecord } from '../../entities/document/record.ts';
import { engineCodes } from '../../entities/language/languages.ts';
import type { Line } from '../../entities/line/model.ts';
import { applyServerReadings } from '../../entities/line/review.ts';
import { recognizeRegions, RemoteError, type RegionImage, type RemoteConfig } from './client.ts';
import { clearCrops, cropLine } from './crops.ts';
import { fileForm } from './fileForm.ts';

/** All lines of the document that would be sent for a second opinion. */
export function linesToSend(rec: DocumentRecord): { page: number; line: Line }[] {
  return rec.pages.flatMap((p, page) => p.lines.filter((l) => l.status === 'pending').map((line) => ({ page, line })));
}

/**
 * Sends the lines the person approved on the consent screen, each as a
 * separate crop (never the whole photo), stores the server's readings next to
 * the device text and deletes every crop, whatever happens.
 */
export async function askServer(
  rec: DocumentRecord,
  server: RemoteConfig,
  approvedIds: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<DocumentRecord> {
  const targets = linesToSend(rec).filter(({ line }) => approvedIds.has(line.id));
  const crops: RegionImage[] = [];
  try {
    for (const { page, line } of targets) {
      if (signal.aborted) {
        throw new RemoteError('cancelled');
      }
      const p = rec.pages[page]!;
      // Line ids ("p0-12") are already valid region ids for the API.
      const crop = await cropLine(pageImage(rec.id, p.image).uri, line.quad, p.width, p.height, line.id);
      const bytes = await new File(crop.uri).bytes();
      crops.push({ id: line.id, bytes, mime: 'image/jpeg', width: crop.width, height: crop.height, uri: crop.uri });
    }
    const consent = { regionIds: approvedIds, languages: engineCodes(rec.languages, 'server') };
    const readings = await recognizeRegions(server, consent, crops, { fetch, buildForm: fileForm, signal });
    let next = rec;
    for (const [i, p] of rec.pages.entries()) {
      next = withLines(next, i, applyServerReadings(p.lines, readings).lines);
    }
    next = withServerUse(next, crops.length);
    saveRecord(next);
    return next;
  } finally {
    clearCrops();
  }
}
