import { File } from 'expo-file-system';

import type { FormBuilder } from './client.ts';

/**
 * Expo replaces the global fetch with its own, whose FormData encoder takes
 * strings, Blobs, or objects with bytes() — such as expo-file-system's File —
 * but not React Native's {uri, name, type} descriptors ("Unsupported FormDataPart
 * implementation"). The crops are already files in the cache (see crops.ts).
 */
export const fileForm: FormBuilder = async (meta, batch) => {
  const form = new FormData();
  form.append('meta', meta);
  for (const r of batch) {
    if (!r.uri) {
      throw new Error(`region ${r.id} has no file to upload`);
    }
    form.append(r.id, new File(r.uri) as unknown as Blob);
  }
  return form;
};
