import { isConfusable, riskyTokens } from './rules.ts';

/** A piece of a line; suspicious pieces are letters that may really be digits. */
export interface Segment {
  readonly text: string;
  readonly suspicious: boolean;
}

/**
 * Splits a line into plain and suspicious pieces for highlighting: inside
 * tokens that mix digits and letters, each digit-like letter is suspicious.
 */
export function highlightSegments(text: string): Segment[] {
  const risky = new Set(riskyTokens(text));
  const segments: Segment[] = [];
  const push = (piece: string, suspicious: boolean) => {
    const last = segments.at(-1);
    if (last && last.suspicious === suspicious) segments[segments.length - 1] = { text: last.text + piece, suspicious };
    else segments.push({ text: piece, suspicious });
  };
  for (const part of text.split(/(\s+)/u)) {
    const token = [...risky].find((t) => part.includes(t));
    if (!token) {
      if (part) push(part, false);
      continue;
    }
    const start = part.indexOf(token);
    push(part.slice(0, start), false);
    for (const ch of token) push(ch, isConfusable(ch));
    push(part.slice(start + token.length), false);
  }
  return segments.filter((s) => s.text.length > 0);
}
