// Меряет правило «к сверке» на синтетическом наборе: какая доля строк уходит в очередь
// и какая доля строк с ошибками в неё попадает. Для сервера два потока: на него уходят
// только строки, уже попавшие в очередь, или вся страница. Строки Vision берутся из
// eval/results/raw/vision-macos, ответы сервера из eval/results/raw/backend.
// Синтетика, Mac, не телефон.
// Запуск: node scripts/eval-review.ts
import fs from 'node:fs';
import path from 'node:path';

import { reviewReasons, type Reason, type Rules } from '../src/entities/line/rules.ts';
import type { Line } from '../src/entities/line/model.ts';

interface ManifestImage {
  file: string;
  kind: string;
  variant: string;
  lines: { text: string }[];
}

interface ResultLine {
  text: string;
  confidence: number;
  bbox: [number, number, number, number];
  candidates?: { text: string; confidence: number }[];
}

const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'eval/synthetic/manifest.json'), 'utf8')) as {
  images: ManifestImage[];
};

function readLines(engine: string, name: string): ResultLine[] {
  const file = path.join(root, 'eval/results/raw', engine, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing result ${file}; run eval/run_mac.sh and cmd/eval-backend first`);
  }
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { lines: ResultLine[] }).lines;
}

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

const strict = (s: string) => s.normalize('NFC').replace(/\s+/gu, ' ').trim();
const meaningful = (s: string) =>
  strict(s).replace(/\s+/gu, '').replace(/[‐‑‒–—―-]/gu, '-').replace(/[«»“”„"'’‘]/gu, '"');

function bestReference(text: string, refs: string[]): string {
  let best = refs[0] ?? '';
  let bestScore = Infinity;
  for (const r of refs) {
    const score = distance(strict(text), strict(r)) / Math.max(text.length, r.length, 1);
    if (score < bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

function overlap(a: ResultLine['bbox'], b: ResultLine['bbox']): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a[2] * a[3] + b[2] * b[3] - w * h);
}

interface Sample {
  line: Line;
  variant: string;
  wrongStrict: boolean;
  wrongMeaningful: boolean;
}

const samples: Sample[] = [];
for (const im of manifest.images.filter((i) => i.kind === 'text')) {
  const name = path.basename(im.file, path.extname(im.file));
  const refs = im.lines.map((l) => l.text);
  const server = readLines('backend', name);
  readLines('vision-macos', name).forEach((r, i) => {
    const ref = bestReference(r.text, refs);
    const match = server.reduce<{ text: string; score: number }>(
      (best, s) => {
        const score = overlap(r.bbox, s.bbox);
        return score > best.score ? { text: s.text, score } : best;
      },
      { text: '', score: 0.3 },
      // overlap must exceed 0.3 to count as the same line
    );
    const [x, y, w, h] = r.bbox;
    samples.push({
      variant: im.variant,
      wrongStrict: strict(r.text) !== strict(ref),
      wrongMeaningful: meaningful(r.text) !== meaningful(ref),
      line: {
        id: `${name}#${i}`,
        quad: [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
        text: r.text,
        confidence: r.confidence,
        candidates: r.candidates ?? [],
        source: 'device',
        status: 'pending',
        ...(match.score > 0.3 ? { serverText: match.text } : {}),
      },
    });
  });
}

interface Variant {
  readonly name: string;
  readonly rules: Rules;
  /** Reasons that count for this variant; others are ignored. */
  readonly reasons: readonly Reason[];
  /** page: every line goes to the server; queued: only lines the offline rules already queued. */
  readonly server: 'none' | 'page' | 'queued';
}

const OFFLINE: readonly Reason[] = ['low_confidence', 'risky_token'];
const variants: readonly Variant[] = [
  { name: 'уверенность < 1', rules: { confidenceBelow: 1, candidates: false }, reasons: ['low_confidence'], server: 'none' },
  { name: '+ рискованные токены', rules: { confidenceBelow: 1, candidates: false }, reasons: OFFLINE, server: 'none' },
  {
    name: '+ расхождение кандидатов Vision',
    rules: { confidenceBelow: 1, candidates: true },
    reasons: [...OFFLINE, 'candidates_disagree'],
    server: 'none',
  },
  {
    name: '+ сервер, на него уходят только строки из очереди',
    rules: { confidenceBelow: 1, candidates: false },
    reasons: [...OFFLINE, 'server_disagrees'],
    server: 'queued',
  },
  {
    name: '+ сервер, на него уходит вся страница',
    rules: { confidenceBelow: 1, candidates: false },
    reasons: [...OFFLINE, 'server_disagrees'],
    server: 'page',
  },
];

function queued(s: Sample, v: Variant): boolean {
  const offline = reviewReasons({ ...s.line, serverText: s.line.text }, v.rules).filter((r) => OFFLINE.includes(r));
  const sent = v.server === 'page' || (v.server === 'queued' && offline.length > 0);
  const line = sent ? s.line : { ...s.line, serverText: s.line.text };
  return reviewReasons(line, v.rules).some((r) => v.reasons.includes(r));
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(0)} %`);
const groups: [string, (s: Sample) => boolean][] = [
  ['все варианты', () => true],
  ['хорошие (clean, scan_skew, photo_perspective)', (s) => ['clean', 'scan_skew', 'photo_perspective'].includes(s.variant)],
  ['плохие (lowlight, blur_lowres)', (s) => ['lowlight', 'blur_lowres'].includes(s.variant)],
];

const out: string[] = ['Синтетика, Vision на Mac и сервер на Mac, не телефон. Текстовые страницы.', ''];
for (const [title, pick] of groups) {
  const set = samples.filter(pick);
  const wrongS = set.filter((s) => s.wrongStrict);
  const wrongM = set.filter((s) => s.wrongMeaningful);
  out.push(`### ${title}: строк ${set.length}, с ошибкой ${wrongS.length} (без учёта тире, кавычек и пробелов ${wrongM.length})`, '');
  out.push('| правило | строк в очереди | поймано ошибочных строк | поймано без учёта тире и кавычек |', '|---|---|---|---|');
  for (const v of variants) {
    const inQueue = set.filter((s) => queued(s, v));
    out.push(
      `| ${v.name} | ${pct(inQueue.length, set.length)} | ${pct(wrongS.filter((s) => queued(s, v)).length, wrongS.length)} | ${pct(wrongM.filter((s) => queued(s, v)).length, wrongM.length)} |`,
    );
  }
  out.push('');
}
process.stdout.write(out.join('\n'));
