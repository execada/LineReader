import { z } from 'zod';

import type { ServerReading } from '../../entities/line/review.ts';

// Limits from docs/api.md; checked here so nothing oversized leaves the phone.
const MAX_REGIONS_PER_REQUEST = 20;
const MAX_REGION_BYTES = 1 << 20;
// The server takes 10 MiB per request; the margin covers multipart headers and meta.
const MAX_BATCH_BYTES = (10 << 20) - (256 << 10);
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 1000;
const MAX_LANGUAGES = 5;
const REGION_ID = /^[A-Za-z0-9_-]{1,32}$/u;
const DEFAULT_TIMEOUT_MS = 60_000;

/** Server address and access token from the settings screen. */
export interface RemoteConfig {
  readonly baseUrl: string;
  readonly token: string;
}

/** What the person approved on the consent screen: exactly these crops, in these languages. */
export interface Consent {
  readonly regionIds: ReadonlySet<string>;
  readonly languages: readonly string[];
}

/** One line crop ready to upload. */
export interface RegionImage {
  readonly id: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly width: number;
  readonly height: number;
  /** The same crop as a local file, for React Native's FormData. */
  readonly uri?: string;
}

/**
 * Builds the multipart body. React Native's FormData cannot take bytes, so the
 * app passes a builder that writes crops to cache files and appends {uri, name, type};
 * blobForm works where Blob accepts bytes (Node, web, tests).
 */
export type FormBuilder = (meta: string, batch: readonly RegionImage[]) => Promise<FormData>;

/** FormBuilder for Node and tests, where Blob accepts bytes. */
export const blobForm: FormBuilder = async (meta, batch) => {
  const form = new FormData();
  form.append('meta', meta);
  for (const r of batch) {
    form.append(r.id, new Blob([r.bytes], { type: r.mime }), r.id);
  }
  return form;
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** How requests are made; fetch and the form builder differ between the app and tests. */
export interface SendOptions {
  readonly fetch: Fetch;
  readonly buildForm: FormBuilder;
  /** Aborting it (the person withdrew consent or left the screen) stops before the next batch. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export type RemoteErrorCode =
  | 'no_consent'
  | 'cancelled'
  | 'insecure'
  | 'invalid_request'
  | 'too_large'
  | 'unauthorized'
  | 'rate_limited'
  | 'busy'
  | 'timeout'
  | 'internal_error'
  | 'network'
  | 'bad_response';

const MESSAGES: Record<RemoteErrorCode, string> = {
  no_consent: 'Этот кусок не отмечен для отправки. Ничего не отправлено.',
  cancelled: 'Отправка остановлена. Оставшиеся куски не отправлены.',
  insecure: 'Адрес сервера без HTTPS. Ничего не отправлено.',
  invalid_request: 'Запрос не прошёл проверку: проверьте адрес сервера, языки и куски.',
  too_large: 'Кусок слишком большой для сервера (больше 1 МБ или 4000×1000 точек).',
  unauthorized: 'Сервер не принял ключ доступа.',
  rate_limited: 'Сервер просит подождать: слишком много кусков за минуту.',
  busy: 'Сервер занят. Повторите через несколько секунд.',
  timeout: 'Сервер не успел распознать куски. Отправьте меньше за раз.',
  internal_error: 'Сервер не смог распознать куски.',
  network: 'Нет связи с сервером. Строки остались распознанными на телефоне.',
  bad_response: 'Сервер ответил непонятно. Строки остались распознанными на телефоне.',
};

/** A failed send with a message for the person; readings from finished batches are kept. */
export class RemoteError extends Error {
  readonly code: RemoteErrorCode;
  /** Readings from batches that finished before the failure. */
  readonly readings: readonly ServerReading[];
  constructor(code: RemoteErrorCode, readings: readonly ServerReading[] = [], options?: { cause?: unknown }) {
    super(MESSAGES[code], options);
    this.name = 'RemoteError';
    this.code = code;
    this.readings = readings;
  }
}

const responseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    engine: z.string(),
    regions: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    ),
  }),
});

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string() }),
});

const SERVER_CODES = new Set<RemoteErrorCode>([
  'invalid_request',
  'too_large',
  'unauthorized',
  'rate_limited',
  'busy',
  'timeout',
  'internal_error',
]);

const STATUS_CODES: Record<number, RemoteErrorCode> = {
  400: 'invalid_request',
  401: 'unauthorized',
  413: 'too_large',
  429: 'rate_limited',
  503: 'busy',
};

/**
 * Sends approved crops to the server and returns its readings. Every region
 * must be in the consent, otherwise nothing is sent at all; the consent is
 * re-checked before each batch.
 */
export async function recognizeRegions(
  config: RemoteConfig,
  consent: Consent,
  regions: readonly RegionImage[],
  options: SendOptions,
): Promise<ServerReading[]> {
  const approved = new Set(consent.regionIds);
  const languages = [...consent.languages];
  const endpoint = checkBeforeSending(config, approved, languages, regions);
  const readings: ServerReading[] = [];
  for (const batch of batches(regions)) {
    if (options.signal?.aborted) {
      throw new RemoteError('cancelled', readings);
    }
    if (batch.some((r) => !approved.has(r.id) || !consent.regionIds.has(r.id))) {
      throw new RemoteError('no_consent', readings);
    }
    try {
      readings.push(...(await send(endpoint, config.token, languages, batch, options)));
    } catch (e) {
      if (e instanceof RemoteError) {
        throw new RemoteError(e.code, readings, { cause: e });
      }
      throw e;
    }
  }
  return readings;
}

function checkBeforeSending(
  config: RemoteConfig,
  approved: ReadonlySet<string>,
  languages: readonly string[],
  regions: readonly RegionImage[],
): string {
  if (regions.some((r) => !approved.has(r.id))) {
    throw new RemoteError('no_consent');
  }
  let url: URL;
  try {
    url = new URL(config.baseUrl);
  } catch (cause) {
    throw new RemoteError('invalid_request', [], { cause });
  }
  const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    throw new RemoteError('insecure');
  }
  const ids = new Set(regions.map((r) => r.id));
  if (
    languages.length === 0 ||
    languages.length > MAX_LANGUAGES ||
    ids.size !== regions.length ||
    regions.some((r) => r.id === 'meta' || !REGION_ID.test(r.id))
  ) {
    throw new RemoteError('invalid_request');
  }
  if (regions.some((r) => r.bytes.byteLength > MAX_REGION_BYTES || r.width > MAX_WIDTH || r.height > MAX_HEIGHT)) {
    throw new RemoteError('too_large');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/u, '')}/v1/regions:recognize`;
}

function batches(regions: readonly RegionImage[]): RegionImage[][] {
  const out: RegionImage[][] = [];
  let current: RegionImage[] = [];
  let bytes = 0;
  for (const r of regions) {
    if (current.length === MAX_REGIONS_PER_REQUEST || bytes + r.bytes.byteLength > MAX_BATCH_BYTES) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(r);
    bytes += r.bytes.byteLength;
  }
  if (current.length > 0) {
    out.push(current);
  }
  return out;
}

async function send(
  endpoint: string,
  token: string,
  languages: readonly string[],
  batch: readonly RegionImage[],
  options: SendOptions,
): Promise<ServerReading[]> {
  const form = await options.buildForm(JSON.stringify({ languages, regions: batch.map((r) => ({ id: r.id })) }), batch);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const stop = () => timeout.abort();
  options.signal?.addEventListener('abort', stop);

  let res: Response;
  let text: string;
  try {
    res = await options.fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      redirect: 'error',
      signal: timeout.signal,
    });
    text = await res.text();
  } catch (cause) {
    const code = options.signal?.aborted ? 'cancelled' : timeout.signal.aborted ? 'timeout' : 'network';
    throw new RemoteError(code, [], { cause });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', stop);
  }

  const body = parseJson(text);
  if (!res.ok) {
    const parsed = errorSchema.safeParse(body);
    const code = parsed.success ? (parsed.data.error.code as RemoteErrorCode) : STATUS_CODES[res.status];
    throw new RemoteError(code !== undefined && SERVER_CODES.has(code) ? code : 'internal_error');
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RemoteError('bad_response');
  }
  const regions = parsed.data.data.regions;
  if (regions.length !== batch.length || regions.some((r, i) => r.id !== batch[i]?.id)) {
    throw new RemoteError('bad_response');
  }
  return regions.map((r) => ({
    id: r.id,
    text: r.text,
    confidence: r.confidence,
  }));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
