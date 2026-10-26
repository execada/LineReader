import { useCallback, useEffect, useState } from 'react';

import { deleteDocument, listRecords, prepareStorage } from '../entities/document/files.ts';
import type { DocumentRecord } from '../entities/document/record.ts';
import { clearCrops } from '../features/ask-server/crops.ts';

/** Saved texts: loaded once at start, then kept in memory next to the files. */
export function useLibrary(notify: (message: string) => void) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    clearCrops();
    prepareStorage()
      .then(() => listRecords(Date.now()))
      .then(({ records, broken }) => {
        setDocs(records);
        if (broken.length > 0) notify(`Не удалось открыть документов: ${broken.length}. Они остались на телефоне.`);
      })
      .catch(() => notify('Не удалось прочитать сохранённые документы.'));
  }, [notify]);

  const add = useCallback((doc: DocumentRecord) => setDocs((all) => [doc, ...all]), []);
  const replace = useCallback((doc: DocumentRecord) => setDocs((all) => all.map((d) => (d.id === doc.id ? doc : d))), []);
  const remove = useCallback(
    (id: string) => {
      try {
        deleteDocument(id);
        setDocs((all) => all.filter((d) => d.id !== id));
      } catch {
        notify('Не удалось удалить документ.');
      }
    },
    [notify],
  );

  return { docs, add, replace, remove };
}
