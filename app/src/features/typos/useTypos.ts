import { useEffect, useState } from 'react';

import SverkaSpell from '../../../modules/sverka-spell/src/index.ts';
import { loadDictionary } from '../../entities/document/files.ts';
import type { DocumentRecord } from '../../entities/document/record.ts';
import { findTypos, type Checker, type Typo } from './typos.ts';

const check: Checker = (words, language) =>
  SverkaSpell.languages().includes(language) ? SverkaSpell.check(words, language) : Promise.resolve([]);

/** Typos of the document as it is now; looked up again whenever its lines change. null while checking. */
export function useTypos(doc: DocumentRecord, kept: readonly string[]) {
  const [result, setResult] = useState<{ doc: DocumentRecord; typos: Typo[] | null; error: string | null }>({
    doc,
    typos: null,
    error: null,
  });

  useEffect(() => {
    let live = true;
    loadDictionary()
      .then((dictionary) => findTypos(doc, check, [...dictionary, ...kept]))
      .then(
        (typos) => live && setResult({ doc, typos, error: null }),
        () => live && setResult({ doc, typos: [], error: 'Проверка орфографии на телефоне недоступна.' }),
      );
    return () => {
      live = false;
    };
  }, [doc, kept]);

  return result.doc === doc ? result : { doc, typos: null, error: null };
}
