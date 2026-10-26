import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blobForm, recognizeRegions, RemoteError, type Consent, type RegionImage, type SendOptions } from './client.ts';

const config = { baseUrl: 'https://ocr.example.test', token: 'tok-0123456789abcdef0123' };

function region(id: string, bytes = 100, width = 300, height = 40): RegionImage {
  return { id, bytes: new Uint8Array(new ArrayBuffer(bytes)), mime: 'image/png', width, height };
}

function ok(ids: string[]) {
  return {
    success: true,
    data: {
      engine: 'tesseract-5.5.3',
      regions: ids.map((id) => ({ id, text: `t-${id}`, confidence: 0.9, words: [] })),
    },
    error: null,
  };
}

interface Call {
  url: string;
  auth: string | null;
  meta: { languages: string[]; regions: { id: string }[] };
  parts: string[];
}

function fakeFetch(reply: (call: Call) => { status: number; body: unknown; raw?: string }, calls: Call[] = []) {
  const fn = async (url: string, init: RequestInit): Promise<Response> => {
    assert.equal(init.redirect, 'error', 'redirects must not be followed');
    const form = init?.body as FormData;
    const call: Call = {
      url: String(url),
      auth: new Headers(init?.headers).get('Authorization'),
      meta: JSON.parse(String(form.get('meta'))),
      parts: [...form.keys()].filter((k) => k !== 'meta'),
    };
    calls.push(call);
    const { status, body, raw } = reply(call);
    return new Response(raw ?? JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fn, calls };
}

const consentAll = (ids: string[]): Consent => ({ regionIds: new Set(ids), languages: ['rus'] });

const opts = (fetch: SendOptions['fetch'], extra: Partial<SendOptions> = {}): SendOptions => ({
  fetch,
  buildForm: blobForm,
  ...extra,
});

test('sends only consented regions, in batches of 20, with the token', async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `r${i}`);
  const { fn, calls } = fakeFetch((c) => ({ status: 200, body: ok(c.meta.regions.map((r) => r.id)) }));
  const readings = await recognizeRegions(
    config,
    consentAll(ids),
    ids.map((id) => region(id)),
    opts(fn),
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, 'https://ocr.example.test/v1/regions:recognize');
  assert.equal(calls[0]?.auth, `Bearer ${config.token}`);
  assert.equal(calls[0]?.parts.length, 20);
  assert.equal(calls[1]?.parts.length, 5);
  assert.deepEqual(calls[0]?.meta.languages, ['rus']);
  assert.equal(readings.length, 25);
  assert.deepEqual(readings[24], { id: 'r24', text: 't-r24', confidence: 0.9 });
});

test('splits batches to stay under the 10 MiB request limit', async () => {
  const ids = Array.from({ length: 12 }, (_, i) => `r${i}`);
  const { fn, calls } = fakeFetch((c) => ({ status: 200, body: ok(c.meta.regions.map((r) => r.id)) }));
  await recognizeRegions(
    config,
    consentAll(ids),
    ids.map((id) => region(id, 900 * 1024)),
    opts(fn),
  );
  assert.deepEqual(
    calls.map((c) => c.parts.length),
    [11, 1],
  );
});

test('keeps a base path and rejects credentials or a broken URL', async () => {
  const { fn, calls } = fakeFetch((c) => ({ status: 200, body: ok(c.meta.regions.map((r) => r.id)) }));
  await recognizeRegions({ ...config, baseUrl: 'https://h.test/ocr/' }, consentAll(['a']), [region('a')], opts(fn));
  assert.equal(calls[0]?.url, 'https://h.test/ocr/v1/regions:recognize');
  for (const [baseUrl, code] of [
    ['https://u:p@h.test', 'insecure'],
    ['not a url', 'invalid_request'],
  ] as const) {
    await assert.rejects(
      recognizeRegions({ ...config, baseUrl }, consentAll(['a']), [region('a')], opts(fn)),
      (e: unknown) => e instanceof RemoteError && e.code === code,
    );
  }
});

test('rejects duplicate, reserved or malformed ids and oversized crops', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200, body: ok([]) }));
  const cases: [RegionImage[], string][] = [
    [[region('a'), region('a')], 'invalid_request'],
    [[region('meta')], 'invalid_request'],
    [[region('a b')], 'invalid_request'],
    [[region('a', 100, 4001, 40)], 'too_large'],
    [[region('a', 100, 300, 1001)], 'too_large'],
  ];
  for (const [regions, code] of cases) {
    await assert.rejects(
      recognizeRegions(config, consentAll(regions.map((r) => r.id)), regions, opts(fn)),
      (e: unknown) => e instanceof RemoteError && e.code === code,
    );
  }
  assert.equal(calls.length, 0);
});

test('withdrawn consent stops the next batch and keeps earlier readings', async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `r${i}`);
  const consent = { regionIds: new Set(ids), languages: ['rus'] };
  const { fn, calls } = fakeFetch((c) => {
    consent.regionIds.delete('r24');
    return { status: 200, body: ok(c.meta.regions.map((r) => r.id)) };
  });
  await assert.rejects(
    recognizeRegions(
      config,
      consent,
      ids.map((id) => region(id)),
      opts(fn),
    ),
    (e: unknown) => e instanceof RemoteError && e.code === 'no_consent' && e.readings.length === 20,
  );
  assert.equal(calls.length, 1);
});

test('abort signal stops before sending', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200, body: ok(['a']) }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn, { signal: controller.signal })),
    (e: unknown) => e instanceof RemoteError && e.code === 'cancelled',
  );
  assert.equal(calls.length, 0);
});

test('a stalled server times out', async () => {
  const fn = (_url: string, init: RequestInit) =>
    new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
  await assert.rejects(
    recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn, { timeoutMs: 20 })),
    (e: unknown) => e instanceof RemoteError && e.code === 'timeout',
  );
});

test('a non-JSON error body is mapped by status, not reported as no connection', async () => {
  for (const [status, code] of [
    [413, 'too_large'],
    [502, 'internal_error'],
    [503, 'busy'],
  ] as const) {
    const { fn } = fakeFetch(() => ({ status, body: null, raw: '<html>Bad Gateway</html>' }));
    await assert.rejects(
      recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn)),
      (e: unknown) => e instanceof RemoteError && e.code === code,
    );
  }
});

test('refuses to send a region the user did not approve', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200, body: ok([]) }));
  await assert.rejects(
    recognizeRegions(config, consentAll(['a']), [region('a'), region('b')], opts(fn)),
    (e: unknown) => e instanceof RemoteError && e.code === 'no_consent',
  );
  assert.equal(calls.length, 0, 'nothing may leave the phone before the check');
});

test('refuses plain http except for a local development server', async () => {
  const { fn } = fakeFetch((c) => ({ status: 200, body: ok(c.meta.regions.map((r) => r.id)) }));
  await assert.rejects(
    recognizeRegions({ ...config, baseUrl: 'http://ocr.example.test' }, consentAll(['a']), [region('a')], opts(fn)),
    (e: unknown) => e instanceof RemoteError && e.code === 'insecure',
  );
  await recognizeRegions({ ...config, baseUrl: 'http://localhost:8080' }, consentAll(['a']), [region('a')], opts(fn));
});

test('checks limits before sending', async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 200, body: ok([]) }));
  await assert.rejects(
    recognizeRegions(config, consentAll(['a']), [region('a', 1024 * 1024 + 1)], opts(fn)),
    (e: unknown) => e instanceof RemoteError && e.code === 'too_large',
  );
  await assert.rejects(
    recognizeRegions(config, { regionIds: new Set(['a']), languages: [] }, [region('a')], opts(fn)),
    (e: unknown) => e instanceof RemoteError && e.code === 'invalid_request',
  );
  assert.equal(calls.length, 0);
});

test('maps server errors to codes with a message for the person', async () => {
  const cases: [number, string][] = [
    [429, 'rate_limited'],
    [503, 'busy'],
    [401, 'unauthorized'],
    [500, 'internal_error'],
  ];
  for (const [status, code] of cases) {
    const { fn } = fakeFetch(() => ({ status, body: { success: false, data: null, error: { code, message: 'x' } } }));
    await assert.rejects(
      recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn)),
      (e: unknown) => e instanceof RemoteError && e.code === code && e.message.length > 10,
    );
  }
});

test('rejects a malformed or mismatched response', async () => {
  const bad = [
    { status: 200, body: { nonsense: true } },
    { status: 200, body: ok(['zzz']) },
    { status: 200, body: { ...ok(['a']), data: { engine: 'x', regions: [{ id: 'a', text: 1 }] } } },
  ];
  for (const reply of bad) {
    const { fn } = fakeFetch(() => reply);
    await assert.rejects(
      recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn)),
      (e: unknown) => e instanceof RemoteError && e.code === 'bad_response',
    );
  }
});

test('network failure becomes a RemoteError', async () => {
  const fn = async (_url: string, _init: RequestInit): Promise<Response> => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(
    recognizeRegions(config, consentAll(['a']), [region('a')], opts(fn)),
    (e: unknown) => e instanceof RemoteError && e.code === 'network',
  );
});
