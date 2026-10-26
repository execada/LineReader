import type { DocumentRecord } from '../../entities/document/record.ts';
import { readingOrder, translationText } from '../../entities/document/text.ts';
import type { Line } from '../../entities/line/model.ts';

/** A cell of a recognized table, by row and column. */
export interface TableCell {
  readonly row: number;
  readonly col: number;
  readonly text: string;
}

/** Plain text: lines top to bottom, then left to right, each on its own line. */
export function toText(lines: readonly Line[]): string {
  return [...lines]
    .sort(readingOrder)
    .map((l) => `${l.text}\n`)
    .join('');
}

/**
 * The TXT file: every page as recognized and, when asked and there is one, the
 * translation after it under a «Перевод PL → RU» heading.
 */
export function textExport(doc: DocumentRecord, withTranslation: boolean): string {
  const original = doc.pages.map((p) => toText(p.lines)).join('\n');
  const translation = withTranslation ? translationText(doc) : '';
  if (!doc.translation || translation.length === 0) return original;
  return `${original}\nПеревод ${doc.translation.source.toUpperCase()} → ${doc.translation.target.toUpperCase()}\n\n${translation}\n`;
}

const FORMULA_START = /^[=+\-@\t\r]/u;
const NEGATIVE_NUMBER = /^-\d+(?:[.,]\d+)?$/u;

// Spreadsheets run cells starting with = + - @ as formulas (CSV injection);
// a leading apostrophe makes them text. Plain negative numbers stay numbers.
function neutralize(text: string): string {
  return FORMULA_START.test(text) && !NEGATIVE_NUMBER.test(text) ? `'${text}` : text;
}

function quote(text: string): string {
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * RFC 4180 CSV with CRLF rows and a UTF-8 byte order mark, without which Excel
 * opens Cyrillic as mojibake; missing cells are empty.
 */
export function toCSV(cells: readonly TableCell[]): string {
  const grid = new Map<string, string>();
  let rows = 0;
  let cols = 0;
  for (const c of cells) {
    if (!Number.isInteger(c.row) || !Number.isInteger(c.col) || c.row < 0 || c.col < 0) {
      throw new Error(`bad cell position ${c.row},${c.col}`);
    }
    const key = `${c.row},${c.col}`;
    if (grid.has(key)) {
      throw new Error(`cell ${key} given twice`);
    }
    grid.set(key, c.text);
    rows = Math.max(rows, c.row + 1);
    cols = Math.max(cols, c.col + 1);
  }
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row = Array.from({ length: cols }, (_, c) => quote(neutralize(grid.get(`${r},${c}`) ?? '')));
    out.push(`${row.join(',')}\r\n`);
  }
  return `\uFEFF${out.join('')}`;
}
