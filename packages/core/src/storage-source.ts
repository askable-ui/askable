import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableStorageSourceSnapshot {
  /** Storage type. */
  storageType: 'localStorage' | 'sessionStorage' | 'custom';
  /** Key-value pairs from the captured storage items. */
  items: Record<string, unknown>;
  /** Total number of items captured. */
  count: number;
}

export interface AskableCreateStorageSourceOptions {
  /**
   * Storage to read from. Defaults to `localStorage` in browser environments.
   * Pass `sessionStorage` or a custom storage-like object.
   */
  storage?: Storage | 'localStorage' | 'sessionStorage';
  /**
   * Specific keys to capture. When provided, only these keys are included.
   * Supports glob-style wildcards: `"cart.*"`, `"user_*"`.
   * When omitted, all keys are captured (subject to `omitKeys`).
   */
  keys?: string[];
  /**
   * Keys to exclude. Useful when `keys` is omitted and you want to block
   * specific items (tokens, private data).
   */
  omitKeys?: string[];
  /**
   * Parse JSON values automatically. When true, values that are valid JSON
   * objects or arrays are parsed before being included in the snapshot.
   * @default true
   */
  parseJSON?: boolean;
  /**
   * Mask values for matching keys (e.g. auth tokens, passwords).
   * Matched values are replaced with `"***"`.
   */
  maskKeys?: string[];
  /**
   * Mask values whose keys look secret-bearing — matching token, secret,
   * password, auth, jwt, api key, credential, session id, cookie, or private —
   * in addition to `maskKeys`. This is a safety net so credentials in
   * localStorage are not serialized into AI context by default. Set to `false`
   * only when you are certain the captured storage holds no secrets.
   * @default true
   */
  maskSensitiveKeys?: boolean;
  /**
   * Custom transformer applied to the captured items before returning.
   * Can be used for field-level sanitization or restructuring.
   */
  sanitize?: (items: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Custom describe function.
   */
  describe?: (snapshot: AskableStorageSourceSnapshot) => string;
  /** Source category. Defaults to "storage". */
  kind?: string;
}

function resolveStorage(storage: Storage | 'localStorage' | 'sessionStorage' | undefined): Storage | null {
  if (!storage || storage === 'localStorage') {
    return typeof window !== 'undefined' ? window.localStorage : null;
  }
  if (storage === 'sessionStorage') {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  }
  return storage;
}

function storageType(storage: Storage | 'localStorage' | 'sessionStorage' | undefined): AskableStorageSourceSnapshot['storageType'] {
  if (!storage || storage === 'localStorage') return 'localStorage';
  if (storage === 'sessionStorage') return 'sessionStorage';
  return 'custom';
}

function matchesGlob(key: string, pattern: string): boolean {
  if (!pattern.includes('*')) return key === pattern;
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '$');
  return regex.test(key);
}

function keyMatchesList(key: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesGlob(key, p));
}

const SENSITIVE_KEY_PATTERN = /token|secret|passw(or)?d|auth|jwt|api[-_]?key|credential|session[-_]?id|cookie|private/i;

function shouldMask(key: string, maskKeys: string[], maskSensitiveKeys: boolean): boolean {
  if (maskKeys.length > 0 && keyMatchesList(key, maskKeys)) return true;
  return maskSensitiveKeys && SENSITIVE_KEY_PATTERN.test(key);
}

function parseValue(raw: string | null, parseJSON: boolean): unknown {
  if (raw === null) return null;
  if (!parseJSON) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function buildSnapshot(
  options: AskableCreateStorageSourceOptions,
): AskableStorageSourceSnapshot {
  const {
    storage,
    keys,
    omitKeys = [],
    parseJSON = true,
    maskKeys = [],
    maskSensitiveKeys = true,
    sanitize,
  } = options;

  const store = resolveStorage(storage);
  const type = storageType(storage);

  if (!store) {
    return { storageType: type, items: {}, count: 0 };
  }

  const items: Record<string, unknown> = {};

  if (keys && keys.length > 0) {
    for (const pattern of keys) {
      if (pattern.includes('*')) {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && matchesGlob(k, pattern) && !keyMatchesList(k, omitKeys)) {
            items[k] = shouldMask(k, maskKeys, maskSensitiveKeys)
              ? '***'
              : parseValue(store.getItem(k), parseJSON);
          }
        }
      } else {
        if (!keyMatchesList(pattern, omitKeys)) {
          const raw = store.getItem(pattern);
          if (raw !== null) {
            items[pattern] = shouldMask(pattern, maskKeys, maskSensitiveKeys)
              ? '***'
              : parseValue(raw, parseJSON);
          }
        }
      }
    }
  } else {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k || keyMatchesList(k, omitKeys)) continue;
      items[k] = shouldMask(k, maskKeys, maskSensitiveKeys)
        ? '***'
        : parseValue(store.getItem(k), parseJSON);
    }
  }

  const finalItems = sanitize ? sanitize(items) : items;

  return {
    storageType: type,
    items: finalItems,
    count: Object.keys(finalItems).length,
  };
}

function defaultDescribe(snapshot: AskableStorageSourceSnapshot): string {
  if (snapshot.count === 0) {
    return `${snapshot.storageType}: empty`;
  }
  const entries = Object.entries(snapshot.items)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');
  return `${snapshot.storageType} (${snapshot.count} items):\n${entries}`;
}

/**
 * Creates a storage context source that exposes localStorage or sessionStorage
 * items to AI assistants — capturing user preferences, cart contents, session
 * flags, feature flags, and other browser-persisted state.
 *
 * @example
 * ```ts
 * // Capture specific keys
 * const cartSource = createAskableStorageSource({
 *   keys: ['cart', 'checkout.*'],
 *   omitKeys: ['authToken'],
 * });
 * ctx.registerSource('cart', cartSource);
 *
 * // Capture sessionStorage with JSON parsing
 * const sessionSource = createAskableStorageSource({
 *   storage: 'sessionStorage',
 *   parseJSON: true,
 *   maskKeys: ['csrfToken'],
 * });
 * ctx.registerSource('session', sessionSource);
 * ```
 */
export function createAskableStorageSource(
  options: AskableCreateStorageSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'storage' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot(options))
      : () => defaultDescribe(buildSnapshot(options)),
    state: () => {
      const snapshot = buildSnapshot(options);
      return { storageType: snapshot.storageType, count: snapshot.count };
    },
    data: () => buildSnapshot(options),
  });
}
