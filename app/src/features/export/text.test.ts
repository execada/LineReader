import { test } from 'node:test';
import assert from 'node:assert/strict';

import { textExport, toText, toCSV, type TableCell } from './text.ts';
import type { Line } from '../../entities/line/model.ts';

function at(id: string, y: number, x: number, text: string): Line {
  return {
    id,
    quad: [
      { x, y },
      { x: x + 50, y },
      { x: x + 50, y: y + 20 },
      { x, y: y + 20 },
    ],
    text,
    confidence: 1,
    candidates: [],
    source: 'device',
    status: 'pending',
  };
}

test('TXT puts lines in reading order, one per line, with a final newline', () => {
  const lines = [at('b', 50, 0, 'второй'), at('a', 10, 0, 'первый'), at('c', 50, 300, 'справа')];
  assert.equal(toText(lines), 'первый\nвторой\nсправа\n');
});

test('TXT of an empty page is empty', () => {
  assert.equal(toText([]), '');
});

test('CSV quotes cells with separators, quotes and newlines and fills gaps', () => {
  const cells: TableCell[] = [
    { row: 0, col: 0, text: '№' },
    { row: 0, col: 1, text: 'Цена, руб.' },
    { row: 1, col: 0, text: '1' },
    { row: 1, col: 1, text: 'кабель "6A"' },
    { row: 2, col: 1, text: 'две\nстроки' },
  ];
  assert.equal(toCSV(cells), '\uFEFF№,"Цена, руб."\r\n1,"кабель ""6A"""\r\n,"две\nстроки"\r\n');
});

test('CSV neutralizes cells that spreadsheets would run as formulas', () => {
  const cells: TableCell[] = [
    { row: 0, col: 0, text: '=HYPERLINK("http://x")' },
    { row: 0, col: 1, text: '-5' },
    { row: 0, col: 2, text: '+7 999' },
    { row: 0, col: 3, text: '@sum' },
  ];
  assert.equal(toCSV(cells), `\uFEFF"'=HYPERLINK(""http://x"")",-5,'+7 999,'@sum\r\n`);
});

test('CSV rejects negative or duplicate cell positions', () => {
  assert.throws(() => toCSV([{ row: -1, col: 0, text: 'x' }]), /position/);
  assert.throws(
    () =>
      toCSV([
        { row: 0, col: 0, text: 'a' },
        { row: 0, col: 0, text: 'b' },
      ]),
    /twice/,
  );
});

test('a text export can carry the translation after the original', () => {
  const base = {
    version: 1 as const,
    id: 'd',
    createdAt: 0,
    languages: ['pl'],
    engine: 'apple-vision',
    sentToServer: 0,
    pages: [{ image: 'p.jpg', width: 100, height: 100, lines: [at('a', 0, 0, 'Zupa 18 zł')] }],
  };
  const doc = {
    ...base,
    translation: {
      source: 'pl',
      target: 'ru',
      engine: 'x',
      paragraphs: [{ lineIds: ['a'], text: 'Zupa 18 zł', translated: 'Суп 18 злотых' }],
    },
  };
  assert.equal(textExport(doc, false), 'Zupa 18 zł\n');
  assert.equal(textExport(doc, true), 'Zupa 18 zł\n\nПеревод PL → RU\n\nСуп 18 злотых\n');
  assert.equal(textExport(base, true), 'Zupa 18 zł\n');
});
