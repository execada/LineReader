import { useEffect, useState } from 'react';

import type { Language } from '../entities/language/languages.ts';
import { deviceLanguages } from '../features/recognize/recognize.ts';

const DEFAULT_LANGUAGES = ['ru', 'en'];

/** Languages this phone can read and the ones chosen for the next text; a chosen language without a model is dropped. */
export function useDeviceLanguages(notify: (message: string) => void) {
  const [available, setAvailable] = useState<Language[]>([]);
  const [chosen, setChosen] = useState<string[]>(DEFAULT_LANGUAGES);

  useEffect(() => {
    deviceLanguages().then(
      (langs) => {
        setAvailable(langs);
        setChosen((ids) => {
          const kept = ids.filter((id) => langs.some((l) => l.id === id));
          return kept.length > 0 ? kept : langs.slice(0, 1).map((l) => l.id);
        });
      },
      () => notify('Не удалось узнать, какие языки распознаются на телефоне.'),
    );
  }, [notify]);

  return { available, chosen, setChosen };
}
