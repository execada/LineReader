// Подбирает порог уверенности строки для Tesseract (Android): какая доля строк
// уходит в очередь «к сверке» и какая доля строк с ошибками в неё попадает.
// Строки и уверенности слов берутся из TSV Tesseract 5.5.3 tessdata_best на Mac
// (eval/results/raw/tesseract-mac); уверенность строки — среднее по словам, как
// RIL_TEXTLINE в Tesseract4Android. Синтетика, Mac, не телефон.
// Запуск: node scripts/eval-tesseract-threshold.ts
import fs from 'node:fs';
import path from 'node:path';

import { riskyTokens } from '../src/entities/line/rules.ts';

interface ManifestImage {
  file: string;
  kind: string;
  variant: string;
  lines: { text: string }[];
}

interface Sample {
  readonly variant: string;
  readonly mean: number;
  readonly min: number;
  readonly risky: boolean;
  readonly wrong: boolean;
}

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'eval/synthetic/manifest.json'), 'utf8')) as { images: ManifestImage[] };
const GOOD = new Set(['clean', 'scan_skew', 'photo_perspective']);
const THRESHOLDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.95];

const strict = (s: string) => s.normalize('NFC').replace(/\s+/gu, ' ').trim();

function distance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const curr = [i];
    for (let j = 1; j <= y.length; j++) {
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[y.length]!;
}

function closest(text: string, refs: readonly string[]): string {
  return refs.reduce(
    (best, r) => {
      const score = distance(strict(text), strict(r)) / Math.max(text.length, r.length, 1);
      return score < best.score ? { ref: r, score } : best;
    },
    { ref: '', score: Infinity },
  ).ref;
}

/** Words of one TSV grouped into lines: text and word confidences in 0..1. */
function tsvLines(file: string): { text: string; confs: number[] }[] {
  const rows = fs.readFileSync(file, 'utf8').split('\n').slice(1);
  const lines = new Map<string, { words: string[]; confs: number[] }>();
  for (const row of rows) {
    const cells = row.split('\t');
    if (cells[0] !== '5' || cells.length < 12) continue;
    const conf = Number(cells[10]);
    const text = cells.slice(11).join('\t').trim();
    if (!text || conf < 0) continue;
    const key = cells.slice(1, 5).join('/');
    const line = lines.get(key) ?? { words: [], confs: [] };
    lines.set(key, { words: [...line.words, text], confs: [...line.confs, conf / 100] });
  }
  return [...lines.values()].map((l) => ({ text: l.words.join(' '), confs: l.confs }));
}

const samples: Sample[] = manifest.images
  .filter((im) => im.kind === 'text')
  .flatMap((im) => {
    const tsv = path.join(root, 'eval/results/raw/tesseract-mac', `${path.basename(im.file, path.extname(im.file))}.tsv`);
    const refs = im.lines.map((l) => l.text);
    return tsvLines(tsv).map((l) => ({
      variant: im.variant,
      mean: l.confs.reduce((a, b) => a + b, 0) / l.confs.length,
      min: Math.min(...l.confs),
      risky: riskyTokens(l.text).length > 0,
      wrong: strict(l.text) !== strict(closest(l.text, refs)),
    }));
  });

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((100 * n) / d)} %`);

function table(title: string, group: readonly Sample[]): string {
  const wrong = group.filter((s) => s.wrong).length;
  const rows = THRESHOLDS.flatMap((t) =>
    (['mean', 'min'] as const).map((kind) => {
      const queued = group.filter((s) => s.risky || s[kind] < t);
      return `| ${kind === 'mean' ? 'средняя' : 'минимальная'} по словам < ${t} | ${pct(queued.length, group.length)} | ${pct(
        queued.filter((s) => s.wrong).length,
        wrong,
      )} |`;
    }),
  );
  return [
    `### ${title}: строк ${group.length}, с ошибкой ${wrong}`,
    '',
    '| правило (+ рискованные токены) | строк в очереди | поймано ошибочных |',
    '|---|---|---|',
    `| только рискованные токены | ${pct(group.filter((s) => s.risky).length, group.length)} | ${pct(
      group.filter((s) => s.risky && s.wrong).length,
      wrong,
    )} |`,
    ...rows,
    '',
  ].join('\n');
}

process.stdout.write(
  [
    'Синтетика, Tesseract 5.5.3 tessdata_best на Mac, не телефон. Текстовые страницы.',
    '',
    table(
      'хорошие (clean, scan_skew, photo_perspective)',
      samples.filter((s) => GOOD.has(s.variant)),
    ),
    table(
      'плохие (lowlight, blur_lowres)',
      samples.filter((s) => !GOOD.has(s.variant)),
    ),
  ].join('\n'),
);
