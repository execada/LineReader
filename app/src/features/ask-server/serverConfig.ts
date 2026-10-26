import * as SecureStore from 'expo-secure-store';

import type { RemoteConfig } from './client.ts';

const URL_KEY = 'sverka.server.url';
const TOKEN_KEY = 'sverka.server.token';
const ASK_KEY = 'sverka.consent.ask';

/** The server address and access token; the token stays in the Keychain / Keystore. */
export async function loadServer(): Promise<RemoteConfig | null> {
  const [baseUrl, token] = await Promise.all([SecureStore.getItemAsync(URL_KEY), SecureStore.getItemAsync(TOKEN_KEY)]);
  if (!baseUrl || !token) return null;
  try {
    return new URL(baseUrl).protocol === 'https:' || __DEV__ ? { baseUrl, token } : null;
  } catch {
    return null;
  }
}

/** Stores the address and token in the Keychain / Keystore. */
export async function saveServer(config: RemoteConfig): Promise<void> {
  const url = new URL(config.baseUrl);
  // Plain http only to a server on the developer's own machine, and only in development builds.
  const local = url.hostname === 'localhost' || url.hostname === '10.0.2.2';
  if (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && local)) {
    throw new Error('Адрес сервера должен начинаться с https://');
  }
  if (config.token.trim().length < 20) {
    throw new Error('Ключ доступа слишком короткий');
  }
  await SecureStore.setItemAsync(URL_KEY, url.toString());
  await SecureStore.setItemAsync(TOKEN_KEY, config.token.trim());
}

/** Deletes the address and token from the phone. */
export async function forgetServer(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(URL_KEY), SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(ASK_KEY)]);
}

/** Whether to show the consent screen before every send; on unless the person turned it off. */
export async function loadAskEachTime(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ASK_KEY)) !== 'no';
}

/** Remembers the «Спрашивать каждый раз» switch. */
export async function saveAskEachTime(ask: boolean): Promise<void> {
  await SecureStore.setItemAsync(ASK_KEY, ask ? 'yes' : 'no');
}
