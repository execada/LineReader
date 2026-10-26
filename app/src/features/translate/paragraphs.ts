import type { Line } from '../../entities/line/model.ts';

// A gap between lines wider than this many line heights starts a new paragraph.
const PARAGRAPH_GAP = 1.2;

/** Lines that read as one piece of text, translated together so sentences are not cut. */
export interface Paragraph {
  readonly lineIds: readonly string[];
  readonly text: string;
}

const height = (l: Line) => Math.max(1, l.quad[3].y - l.quad[0].y);

// A line continues the previous one when the previous breaks a word or the next starts in lower case;
// a capital letter after a line break is a new item, heading or sentence.
function continues(prev: string, next: string): boolean {
  return prev.endsWith('-') || /^\p{Ll}/u.test(next);
}

function join(a: string, b: string): string {
  return a.endsWith('-') && /\p{L}$/u.test(a.slice(0, -1)) ? a.slice(0, -1) + b : `${a} ${b}`;
}

/** Groups lines already in reading order into paragraphs by the gaps between them and how they continue. */
export function paragraphs(lines: readonly Line[]): Paragraph[] {
  const out: { ids: string[]; text: string; bottom: number; height: number }[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const last = out.at(-1);
    const gap = last ? line.quad[0].y - last.bottom : Infinity;
    if (last && gap <= PARAGRAPH_GAP * Math.max(last.height, height(line)) && continues(last.text, text)) {
      out[out.length - 1] = { ids: [...last.ids, line.id], text: join(last.text, text), bottom: line.quad[3].y, height: height(line) };
    } else {
      out.push({ ids: [line.id], text, bottom: line.quad[3].y, height: height(line) });
    }
  }
  return out.map((p) => ({ lineIds: p.ids, text: p.text }));
}
