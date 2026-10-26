import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportFile, pageImage } from '../../entities/document/files.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { searchablePdf } from './pdf.ts';
import { translationText } from '../../entities/document/text.ts';
import { linesToCells } from './cells.ts';
import { textExport, toCSV } from './text.ts';

const PAGE_DPI = 150;

/** Opens the share sheet, then removes the temporary file so no copy stays in the cache. */
async function share(file: File, mimeType: string) {
  try {
    await Sharing.shareAsync(file.uri, { mimeType });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Shares the text of every page as one TXT file, with the translation after it when asked. */
export async function shareText(doc: DocumentRecord, withTranslation: boolean): Promise<void> {
  await share(exportFile(`${doc.id}.txt`, textExport(doc, withTranslation)), 'text/plain');
}

/**
 * Lines of every page laid out as a table and shared as CSV for Excel and
 * Google Sheets; the pages follow one another.
 */
export async function shareCsv(doc: DocumentRecord): Promise<void> {
  let offset = 0;
  const cells = doc.pages.flatMap((p) => {
    const page = linesToCells(p.lines).map((c) => ({ ...c, row: c.row + offset }));
    offset += new Set(page.map((c) => c.row)).size;
    return page;
  });
  await share(exportFile(`${doc.id}.csv`, toCSV(cells)), 'text/csv');
}

/**
 * Builds a PDF with the page photos and an invisible text layer, and the
 * translation after them when asked, then shares it. Returns how many lines did
 * not fit into the text layer because the font lacks their script.
 */
export async function sharePdf(doc: DocumentRecord, withTranslation: boolean): Promise<number> {
  const [font] = await Asset.loadAsync(require('../../../assets/fonts/IBMPlexMono-Regular.ttf'));
  const fontBytes = await new File(font!.localUri!).bytes();
  const pages = await Promise.all(
    doc.pages.map(async (p) => ({
      image: await pageImage(doc.id, p.image).bytes(),
      format: 'jpeg' as const,
      widthPx: p.width,
      heightPx: p.height,
      dpi: PAGE_DPI,
      lines: p.lines,
    })),
  );
  const translation = withTranslation && doc.translation ? translationText(doc) : '';
  const appendix = translation
    ? { title: `Перевод ${doc.translation!.source.toUpperCase()} → ${doc.translation!.target.toUpperCase()}`, text: translation }
    : undefined;
  const { pdf, skipped } = await searchablePdf(pages, fontBytes, appendix);
  await share(exportFile(`${doc.id}.pdf`, pdf), 'application/pdf');
  return skipped.length;
}
