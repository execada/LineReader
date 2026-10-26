import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseRecord,
  serializeRecord,
  newRecord,
  withPage,
  withLines,
  withServerUse,
  withTranslation,
  type DocumentRecord,
} from './record.ts';
import type { Line } from '../line/model.ts';

const line: Line = {
  id: 'p0-0',
  quad: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ],
  text: 'Акт',
  confidence: 1,
  candidates: [{ text: 'Акт', confidence: 1 }],
  source: 'device',
  status: 'pending',
};

test('a record survives a round trip through JSON', () => {
  const rec = withPage(newRecord('d1', ['ru'], 'apple-vision', 1_800_000_000_000), {
    image: 'page-0.jpg',
    width: 1240,
    height: 1754,
    lines: [line],
  });
  const back = parseRecord(serializeRecord(rec));
  assert.deepEqual(back, rec);
});

test('updates return new records and keep the original', () => {
  const rec = withPage(newRecord('d1', ['ru'], 'apple-vision', 0), {
    image: 'page-0.jpg',
    width: 1,
    height: 1,
    lines: [line],
  });
  const edited = withLines(rec, 0, [{ ...line, text: 'Акты', status: 'edited', source: 'user' }]);
  assert.equal(rec.pages[0]?.lines[0]?.text, 'Акт');
  assert.equal(edited.pages[0]?.lines[0]?.text, 'Акты');
  assert.throws(() => withLines(rec, 3, []), /page 3/);
});

test('a broken or foreign file is rejected', () => {
  assert.throws(() => parseRecord('{'));
  assert.throws(() => parseRecord(JSON.stringify({ version: 2 })));
  const bad: unknown = {
    ...newRecord('d1', ['ru'], 'x', 0),
    pages: [{ image: '../../etc/passwd', width: 1, height: 1, lines: [] }],
  };
  assert.throws(() => parseRecord(JSON.stringify(bad)), /image/);
});

test('ids are file-name safe', () => {
  assert.throws(() => newRecord('../x', ['ru'], 'x', 0), /id/);
  const r: DocumentRecord = newRecord('2026-10-14_1', ['ru'], 'x', 0);
  assert.equal(r.id, '2026-10-14_1');
});

test('server use is counted and starts at zero', () => {
  const rec = newRecord('d1', ['ru'], 'x', 0);
  assert.equal(rec.sentToServer, 0);
  assert.equal(withServerUse(withServerUse(rec, 12), 3).sentToServer, 15);
});

test('a translation is stored with the record and survives a round trip', () => {
  const rec = withPage(newRecord('d1', ['pl'], 'apple-vision', 0), { image: 'page-0.jpg', width: 10, height: 10, lines: [line] });
  const translated = withTranslation(rec, {
    source: 'pl',
    target: 'ru',
    engine: 'apple-translation',
    paragraphs: [{ lineIds: ['p0-0'], text: 'Zupa', translated: 'Суп' }],
  });
  assert.equal(rec.translation, undefined);
  assert.deepEqual(parseRecord(serializeRecord(translated)), translated);
});

test('a record saved before translations existed still opens', () => {
  const rec = withPage(newRecord('d1', ['ru'], 'apple-vision', 0), { image: 'page-0.jpg', width: 10, height: 10, lines: [line] });
  assert.equal(parseRecord(serializeRecord(rec)).translation, undefined);
});

test('dot names cannot stand for a document or a page photo', () => {
  assert.throws(() => newRecord('..', ['ru'], 'x', 0), /id/);
  assert.throws(() => newRecord('.hidden', ['ru'], 'x', 0), /id/);
  const bad: unknown = { ...newRecord('d1', ['ru'], 'x', 0), pages: [{ image: '..', width: 1, height: 1, lines: [] }] };
  assert.throws(() => parseRecord(JSON.stringify(bad)), /image/);
});

test('line ids are safe as crop file names', () => {
  const bad: unknown = {
    ...newRecord('d1', ['ru'], 'x', 0),
    pages: [{ image: 'page-0.jpg', width: 10, height: 10, lines: [{ ...line, id: '../../x' }] }],
  };
  assert.throws(() => parseRecord(JSON.stringify(bad)));
});

test('an oversized doc.json is rejected instead of slowing the app down', () => {
  const huge: unknown = {
    ...newRecord('d1', ['ru'], 'x', 0),
    pages: [{ image: 'page-0.jpg', width: 10, height: 10, lines: [{ ...line, text: 'а'.repeat(20_001) }] }],
  };
  assert.throws(() => parseRecord(JSON.stringify(huge)));
  const many: unknown = { ...newRecord('d1', ['ru'], 'x', 0), languages: Array.from({ length: 21 }, () => 'ru') };
  assert.throws(() => parseRecord(JSON.stringify(many)));
});
