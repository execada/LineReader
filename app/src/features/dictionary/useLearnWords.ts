import { useCallback, useRef } from 'react';

import { loadDictionary, saveDictionary } from '../../entities/document/files.ts';
import { learnWords, mergeDictionary } from './dictionary.ts';

const DICTIONARY_SIZE = 500;

/**
 * The personal dictionary: words a person typed in corrections or chose to keep
 * on the typo screen. Updates run one after another so two quick edits do not
 * overwrite each other.
 */
export function useLearnWords(notify: (message: string) => void) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const add = useCallback(
    (words: string[]) => {
      if (words.length === 0) return;
      queue.current = queue.current
        .then(async () => saveDictionary(mergeDictionary(await loadDictionary(), words, DICTIONARY_SIZE)))
        .catch(() => notify('Слова не сохранились в словарь.'));
    },
    [notify],
  );
  const learn = useCallback((before: string, after: string) => add(learnWords(before, after)), [add]);
  const keep = useCallback((word: string) => add([word]), [add]);
  return { learn, keep };
}
