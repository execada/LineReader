// Собирает searchable PDF из картинки eval-набора и эталонных строк manifest.json
// модулем src/export/pdf.ts; проверка извлечения: swift scripts/verify-pdf.swift.
// Запуск: node scripts/make-pdf.ts <eval-set-dir> <image-file> <out.pdf>
import fs from 'node:fs';
import path from 'node:path';

import { searchablePdf } from '../src/features/export/pdf.ts';
import type { Line } from '../src/entities/line/model.ts';

const [setDir, imageFile, outPath] = process.argv.slice(2);
if (!setDir || !imageFile || !outPath) {
  process.stderr.write('usage: node scripts/make-pdf.ts <eval-set-dir> <image-file> <out.pdf>\n');
  process.exit(64);
}
const manifest = JSON.parse(fs.readFileSync(path.join(setDir, 'manifest.json'), 'utf8')) as {
  images: { file: string; size_px: [number, number]; lines: { text: string; polygon: [number, number][] }[] }[];
};
const entry = manifest.images.find((im) => im.file === imageFile);
if (!entry) {
  throw new Error(`${imageFile} is not in the manifest`);
}
const lines: Line[] = entry.lines.map((l, i) => ({
  id: String(i),
  quad: l.polygon.map(([x, y]) => ({ x, y })) as unknown as Line['quad'],
  text: l.text,
  confidence: 1,
  candidates: [],
  source: 'device',
  status: 'confirmed',
}));
const font = fs.readFileSync(path.resolve(import.meta.dirname, '../assets/fonts/IBMPlexMono-Regular.ttf'));
const { pdf, skipped } = await searchablePdf(
  [
    {
      image: fs.readFileSync(path.join(setDir, imageFile)),
      format: imageFile.endsWith('.png') ? 'png' : 'jpeg',
      widthPx: entry.size_px[0],
      heightPx: entry.size_px[1],
      dpi: 150,
      lines,
    },
  ],
  font,
);
fs.writeFileSync(outPath, pdf);
if (skipped.length > 0) {
  process.stderr.write(`not in the text layer: ${JSON.stringify(skipped)}\n`);
}
