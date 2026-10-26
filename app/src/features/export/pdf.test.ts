import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import { PDFDocument } from '@cantoo/pdf-lib';

import { searchablePdf, type PdfPage } from './pdf.ts';
import type { Line } from '../../entities/line/model.ts';

const font = fs.readFileSync(path.resolve(import.meta.dirname, '../../../assets/fonts/IBMPlexMono-Regular.ttf'));
const png = fs.readFileSync(path.resolve(import.meta.dirname, '../../../../eval/synthetic/images/ru_clean.png'));

function line(id: string, text: string, y: number, tilt = 0): Line {
  return {
    id,
    quad: [
      { x: 100, y },
      { x: 900, y: y + tilt },
      { x: 900, y: y + tilt + 40 },
      { x: 100, y: y + 40 },
    ],
    text,
    confidence: 1,
    candidates: [],
    source: 'device',
    status: 'confirmed',
  };
}

const page: PdfPage = {
  image: png,
  format: 'png',
  widthPx: 1240,
  heightPx: 1754,
  dpi: 150,
  lines: [line('a', 'Акт приёмки № 47', 150), line('b', 'Съешь же ещё, Łódź', 300, 30)],
};

function contentStreams(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1');
  const out: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const body = Buffer.from(m[1]!, 'latin1');
    try {
      out.push(zlib.inflateSync(body).toString('latin1'));
    } catch {
      out.push(m[1]!);
    }
  }
  return out.join('\n');
}

test('each line is drawn once as invisible text over the page image', async () => {
  const { pdf: bytes, skipped } = await searchablePdf([page, page], font);
  assert.deepEqual(skipped, []);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
  assert.ok(Math.abs(w - (1240 * 72) / 150) < 0.01 && Math.abs(h - (1754 * 72) / 150) < 0.01, `page ${w}×${h}`);
  const streams = contentStreams(bytes);
  assert.equal(streams.match(/\b3 Tr\b/g)?.length, 4);
  assert.equal(streams.match(/\b[0-24-7] Tr\b/g), null, 'no visible text modes');
  assert.match(streams, /beginbfchar|beginbfrange/, 'ToUnicode map present, text is extractable');
  assert.equal(streams.match(/\bq\b[\s\S]*?\b3 Tr\b[\s\S]*?\bQ\b/g)?.length, 4, 'text state is saved and restored');
});

test('rejects no pages, a bad size, or a size that does not match the image', async () => {
  await assert.rejects(searchablePdf([], font), /at least one page/);
  await assert.rejects(searchablePdf([{ ...page, widthPx: 0 }], font), /size/);
  await assert.rejects(searchablePdf([{ ...page, widthPx: 1000 }], font), /does not match/);
});

test('a line slightly outside the page is clamped and still drawn', async () => {
  const off = line('o', 'край', 100);
  const shifted = {
    ...off,
    quad: off.quad.map((p) => ({
      x: p.x - 100.5,
      y: p.y,
    })) as unknown as Line['quad'],
  };
  const { pdf, skipped } = await searchablePdf([{ ...page, lines: [shifted] }], font);
  assert.deepEqual(skipped, []);
  assert.equal(contentStreams(pdf).match(/\b3 Tr\b/g)?.length, 1);
});

test('lines the font cannot write or with broken geometry are reported, the rest is drawn', async () => {
  const nan = {
    ...line('n', 'нан', 100),
    quad: line('n', '', 100).quad.map((p) => ({
      x: Number.NaN,
      y: p.y,
    })) as unknown as Line['quad'],
  };
  const { pdf, skipped } = await searchablePdf(
    [
      {
        ...page,
        lines: [line('ar', 'محضر استلام', 100), line('zh', '交接验收单', 200), nan, line('ok', 'Акт', 300)],
      },
    ],
    font,
  );
  assert.deepEqual(skipped, [
    { page: 0, id: 'ar', reason: 'font' },
    { page: 0, id: 'zh', reason: 'font' },
    { page: 0, id: 'n', reason: 'geometry' },
  ]);
  assert.equal(contentStreams(pdf).match(/\b3 Tr\b/g)?.length, 1);
});

test('empty lines are skipped, not drawn', async () => {
  const { pdf } = await searchablePdf([{ ...page, lines: [line('e', '   ', 100)] }], font);
  assert.equal(contentStreams(pdf).match(/\b3 Tr\b/g), null);
});

test('a translation goes after the photos as pages of visible text', async () => {
  const long = Array.from({ length: 120 }, (_, i) => `Абзац ${i + 1}: суп дня и компот из вишни.`).join('\n\n');
  const { pdf: bytes } = await searchablePdf([page], font, { title: 'Перевод PL → RU', text: long });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 3, `expected the translation to take several pages, got ${doc.getPageCount()}`);
  assert.equal(doc.getPage(1).getWidth(), 595.28);
  assert.match(contentStreams(bytes), / Tj/);
});
