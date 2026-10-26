import type { Line } from '../../entities/line/model.ts';
import type { TableCell } from './text.ts';

interface Placed {
  readonly line: Line;
  readonly left: number;
  readonly center: number;
  readonly height: number;
}

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/**
 * Lays recognized lines out as a table for CSV: lines whose vertical centres
 * are within half a line height form a row; left edges closer than a line
 * height and a half form a column. Two lines in one cell are joined by a space.
 * Works for menus, price lists and simple tables; a plain paragraph is one column.
 */
export function linesToCells(lines: readonly Line[]): TableCell[] {
  const placed: Placed[] = lines
    .filter((l) => l.text.trim().length > 0)
    .map((l) => {
      const ys = l.quad.map((p) => p.y);
      return {
        line: l,
        left: Math.min(...l.quad.map((p) => p.x)),
        center: (Math.min(...ys) + Math.max(...ys)) / 2,
        height: Math.max(...ys) - Math.min(...ys),
      };
    });
  if (placed.length === 0) return [];
  const h = Math.max(1, median(placed.map((p) => p.height)));

  const rows: Placed[][] = [];
  for (const p of [...placed].sort((a, b) => a.center - b.center)) {
    const row = rows.at(-1);
    if (row && Math.abs(p.center - median(row.map((r) => r.center))) <= h / 2) row.push(p);
    else rows.push([p]);
  }

  const lefts = placed.map((p) => p.left).sort((a, b) => a - b);
  const anchors: number[][] = [];
  for (const x of lefts) {
    const group = anchors.at(-1);
    if (group && x - group.at(-1)! <= h * 1.5) group.push(x);
    else anchors.push([x]);
  }
  const columns = anchors.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const column = (x: number) => columns.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(columns[best]! - x) ? i : best), 0);

  return rows.flatMap((row, r) => {
    const byCol = new Map<number, string[]>();
    for (const p of [...row].sort((a, b) => a.left - b.left)) {
      const c = column(p.left);
      byCol.set(c, [...(byCol.get(c) ?? []), p.line.text.trim()]);
    }
    return [...byCol.entries()].sort(([a], [b]) => a - b).map(([c, texts]) => ({ row: r, col: c, text: texts.join(' ') }));
  });
}
