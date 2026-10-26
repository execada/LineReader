import {
  PDFDocument,
  TextRenderingMode,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  type PDFFont,
  type PDFPage,
} from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import type { Line, Point } from '../../entities/line/model.ts';

interface SkippedLine {
  readonly page: number;
  readonly id: string;
  /** font: the embedded font has no glyph for some character; geometry: the quad is not finite. */
  readonly reason: 'font' | 'geometry';
}

/** The PDF bytes and lines left out of the text layer. */
export interface PdfResult {
  readonly pdf: Uint8Array;
  /** Lines left out of the invisible text layer; the page image still shows them. */
  readonly skipped: readonly SkippedLine[];
}

/** One page for the PDF: its photo and the lines to put over it as invisible text. */
export interface PdfPage {
  readonly image: Uint8Array;
  readonly format: 'png' | 'jpeg';
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpi: number;
  readonly lines: readonly Line[];
}

/** Visible text added after the photos, e.g. the translation. */
export interface TextAppendix {
  readonly title: string;
  readonly text: string;
}

// A4 in points, with margins and type for the appended text pages.
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const BODY_SIZE = 11;
const TITLE_SIZE = 15;
const LEADING = 1.45;

// Text height as a share of the line box; the rest is ascender and descender room.
const TEXT_HEIGHT = 0.8;

/**
 * Builds a searchable PDF: each page is the photo, with every line laid over
 * it as invisible text (rendering mode 3), rotated and stretched to its quad,
 * so search and copy find the words where they are printed.
 * The font must cover the script of the lines; IBM Plex Mono covers Latin and Cyrillic.
 */
export async function searchablePdf(pages: readonly PdfPage[], fontBytes: Uint8Array, appendix?: TextAppendix): Promise<PdfResult> {
  if (pages.length === 0) {
    throw new Error('a PDF needs at least one page');
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Subsetting with @pdf-lib/fontkit 1.1.1 fails on IBM Plex Mono, so the whole font is embedded.
  const font = await doc.embedFont(fontBytes, { subset: false });
  const glyphs = new Set(font.getCharacterSet());
  const skipped: SkippedLine[] = [];
  for (const [i, p] of pages.entries()) {
    skipped.push(...(await addPage(doc, font, glyphs, p, i)));
  }
  if (appendix) addTextPages(doc, font, glyphs, appendix);
  return { pdf: await doc.save(), skipped };
}

async function addPage(doc: PDFDocument, font: PDFFont, glyphs: ReadonlySet<number>, p: PdfPage, index: number): Promise<SkippedLine[]> {
  if (!(p.widthPx > 0 && p.heightPx > 0 && p.dpi > 0)) {
    throw new Error(`bad page size ${p.widthPx}×${p.heightPx} at ${p.dpi} dpi`);
  }
  const image = p.format === 'png' ? await doc.embedPng(p.image) : await doc.embedJpg(p.image);
  if (image.width !== p.widthPx || image.height !== p.heightPx) {
    throw new Error(`page size ${p.widthPx}×${p.heightPx} does not match the image ${image.width}×${image.height}`);
  }
  const scale = 72 / p.dpi;
  const page = doc.addPage([p.widthPx * scale, p.heightPx * scale]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  const fontKey = page.node.newFontDictionary(font.name, font.ref);

  // Engines return quads that overshoot the page by a pixel or so; clamp rather than fail.
  const toPdf = (pt: Point): Point => {
    const x = Math.min(Math.max(pt.x, 0), p.widthPx);
    const y = Math.min(Math.max(pt.y, 0), p.heightPx);
    return { x: x * scale, y: page.getHeight() - y * scale };
  };
  const skipped: SkippedLine[] = [];
  for (const line of p.lines) {
    if (line.text.trim() === '') {
      continue;
    }
    if (!line.quad.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))) {
      skipped.push({ page: index, id: line.id, reason: 'geometry' });
      continue;
    }
    if ([...line.text].some((ch) => !glyphs.has(ch.codePointAt(0)!) && ch.trim() !== '')) {
      skipped.push({ page: index, id: line.id, reason: 'font' });
      continue;
    }
    drawInvisible(page, font, fontKey, line.text, line.quad.map(toPdf) as [Point, Point, Point, Point]);
  }
  return skipped;
}

function drawInvisible(
  page: PDFPage,
  font: PDFFont,
  fontKey: ReturnType<PDFPage['node']['newFontDictionary']>,
  text: string,
  [tl, tr, , bl]: [Point, Point, Point, Point],
): void {
  const width = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const height = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const size = height * TEXT_HEIGHT;
  const natural = font.widthOfTextAtSize(text, size);
  // Baseline sits above the bottom-left corner by the descender room, along the line's normal.
  const lift = height * (1 - TEXT_HEIGHT);
  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFontAndSize(fontKey, size),
    setTextRenderingMode(TextRenderingMode.Invisible),
    setCharacterSqueeze(natural > 0 ? (width / natural) * 100 : 100),
    setTextMatrix(cos, sin, -sin, cos, bl.x - sin * lift, bl.y + cos * lift),
    showText(font.encodeText(text)),
    endText(),
    popGraphicsState(),
  );
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  return text.split('\n').flatMap((paragraph) => {
    if (paragraph.trim() === '') return [''];
    const out: string[] = [];
    let current = '';
    for (const word of paragraph.split(/\s+/u)) {
      const next = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(next, size) > width) {
        out.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    return [...out, current];
  });
}

/** Adds A4 pages with the appendix as ordinary visible text; characters the font lacks become «?». */
function addTextPages(doc: PDFDocument, font: PDFFont, glyphs: ReadonlySet<number>, appendix: TextAppendix): void {
  const clean = (s: string) => [...s].map((ch) => (glyphs.has(ch.codePointAt(0)!) || ch.trim() === '' ? ch : '?')).join('');
  const width = A4[0] - MARGIN * 2;
  const lines = wrap(clean(appendix.text), font, BODY_SIZE, width);
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN - TITLE_SIZE;
  page.drawText(clean(appendix.title), { x: MARGIN, y, size: TITLE_SIZE, font });
  y -= TITLE_SIZE * 2;
  for (const line of lines) {
    if (y < MARGIN) {
      page = doc.addPage(A4);
      y = A4[1] - MARGIN - BODY_SIZE;
    }
    if (line) page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font });
    y -= BODY_SIZE * LEADING;
  }
}
