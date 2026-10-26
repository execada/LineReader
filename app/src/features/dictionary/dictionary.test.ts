import { test } from 'node:test';
import assert from 'node:assert/strict';

import { learnWords, mergeDictionary } from './dictionary.ts';

test('learns the words a person changed, not the ones that were already right', () => {
  assert.deepEqual(learnWords('ООО «Северный Мост», ИНН 66O0', 'ООО «Северный Мост», ИНН 6600'), []);
  assert.deepEqual(learnWords('Акт приемки Сеевеоный', 'Акт приёмки Северный'), ['приёмки', 'Северный']);
});

test('ignores numbers and one-letter tokens: they are not dictionary words', () => {
  assert.deepEqual(learnWords('сумма 1OO руб', 'сумма 100 руб'), []);
  assert.deepEqual(learnWords('a b', 'x y'), []);
});

test('merge keeps order, drops duplicates and caps the size', () => {
  assert.deepEqual(mergeDictionary(['а1', 'б'], ['б', 'в'], 10), ['а1', 'б', 'в']);
  assert.deepEqual(mergeDictionary(['a', 'b', 'c'], ['d'], 3), ['b', 'c', 'd']);
});
