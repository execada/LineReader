import { useEffect, useState } from 'react';

import type { RemoteConfig } from './client.ts';
import { forgetServer, loadAskEachTime, loadServer, saveAskEachTime, saveServer } from './serverConfig.ts';

/**
 * The configured server, or null when the app works only on the phone, and
 * whether the consent screen is shown before every send.
 */
export function useServer() {
  const [server, setServer] = useState<RemoteConfig | null>(null);
  const [askEachTime, setAsk] = useState(true);

  useEffect(() => {
    loadServer().then(setServer, () => setServer(null));
    loadAskEachTime().then(setAsk, () => setAsk(true));
  }, []);

  const save = async (config: RemoteConfig) => {
    await saveServer(config);
    setServer(await loadServer());
  };
  const forget = async () => {
    await forgetServer();
    setServer(null);
    setAsk(true);
  };
  const setAskEachTime = async (ask: boolean) => {
    await saveAskEachTime(ask);
    setAsk(ask);
  };

  return { server, save, forget, askEachTime, setAskEachTime };
}
