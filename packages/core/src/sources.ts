import type {
  AskableContextSource,
  AskableContextSourceMode,
  AskableContextSourceResolveRequest,
  AskablePacketSourceSelection,
  AskableResolvedContextSource,
} from './types.js';

export type AskableSourceValue<T> = T | (() => T | Promise<T>);
export type AskableSourceResolver<T> = (
  request: AskableContextSourceResolveRequest
) => T | Promise<T>;
export type AskableSourceModeMap<T> = Record<string, T | AskableSourceResolver<T>>;

export function isAskablePacketSourceSelection(
  selection: unknown,
): selection is AskablePacketSourceSelection {
  if (!selection || typeof selection !== 'object') return false;
  const value = selection as Partial<AskablePacketSourceSelection>;
  return Boolean(value.capture && typeof value.capture === 'object' && value.source && typeof value.source === 'object');
}

export interface AskableCreateSourceOptions<TData = unknown, TState = unknown> {
  /** Source category. Examples: "document", "collection", "chart", "map", "canvas". */
  kind?: string;
  /** Human-readable source description. */
  describe?: string | (() => string | Promise<string>);
  /** Current app state for this source. */
  state?: AskableSourceValue<TState>;
  /** App-owned context data. Receives the same request that custom sources receive. */
  data?: TData | ((request: AskableContextSourceResolveRequest) => TData | Promise<TData>);
  /** Named context slices keyed by source mode, such as "summary", "selected", "all", or app-defined modes. */
  modes?: AskableSourceModeMap<TData>;
  /** Custom resolver for advanced source behavior. Overrides `data` when provided. */
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  /** Redact or transform this source before serialization. */
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}

export interface AskableCollectionSourceData<TItem = unknown> {
  mode: AskableContextSourceMode;
  items?: TItem[];
  summary?: unknown;
  totalCount?: number;
  returnedCount?: number;
  truncated?: boolean;
}

export interface AskableCreateCollectionSourceOptions<TItem = unknown, TState = unknown> {
  /** Source category. Defaults to "collection". */
  kind?: string;
  /** Human-readable source description. */
  describe?: string | (() => string | Promise<string>);
  /** Current collection state, such as filters, sort, page, route, or query. */
  getState?: () => TState | Promise<TState>;
  /** All logical items, including items not currently mounted in the DOM. */
  getItems?: () => readonly TItem[] | Promise<readonly TItem[]>;
  /** Items currently visible on screen. */
  getVisibleItems?: () => readonly TItem[] | Promise<readonly TItem[]>;
  /** Items explicitly selected by the user or active app state. */
  getSelectedItems?: (request: AskableContextSourceResolveRequest) => readonly TItem[] | Promise<readonly TItem[]>;
  /** Lightweight aggregate summary for prompt budgets. */
  getSummary?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  /** Fallback for custom modes. */
  resolve?: (request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  /** Default item cap when the request does not provide `maxItems`. */
  maxItems?: number;
  /** Redact or transform each returned item. */
  sanitizeItem?: (item: TItem, request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>;
  /** Redact or transform this source before serialization. */
  sanitize?: (source: AskableResolvedContextSource) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>;
}

/**
 * Creates a generic app-owned context source that exposes arbitrary data to AI context.
 * Use this for document, canvas, chart, or any non-collection data that doesn't need
 * built-in item pagination modes.
 *
 * @example
 * ```ts
 * const editorSource = createAskableSource({
 *   kind: 'document',
 *   describe: 'Currently open editor document',
 *   state: () => ({ filename: editor.filename, isDirty: editor.isDirty }),
 *   data: ({ mode }) => mode === 'summary'
 *     ? { wordCount: editor.wordCount }
 *     : { content: editor.getText() },
 * });
 * ctx.registerSource('editor', editorSource);
 * ```
 */
export function createAskableSource<TData = unknown, TState = unknown>(
  options: AskableCreateSourceOptions<TData, TState>,
): AskableContextSource {
  const resolve = options.resolve ?? buildSourceResolver(options);

  return {
    kind: options.kind,
    describe: options.describe,
    getState: options.state === undefined
      ? undefined
      : () => resolveSourceValue(options.state),
    resolve,
    sanitize: options.sanitize,
  };
}

/**
 * Creates a collection source that understands list-oriented modes (summary, visible,
 * selected, all) and handles item capping, async sanitization, and state tracking.
 * Prefer this over `createAskableSource` for tables, lists, feeds, and other iterable data.
 *
 * @example
 * ```ts
 * const accountsSource = createAskableCollectionSource({
 *   describe: 'Accounts matching active filters',
 *   getState: () => ({ filter: activeFilter, sort: currentSort }),
 *   getItems: () => allAccounts,
 *   getVisibleItems: () => visibleRows,
 *   getSummary: () => ({ total: allAccounts.length, filtered: visibleRows.length }),
 *   maxItems: 50,
 *   sanitizeItem: (account) => {
 *     const { internalId: _, ...safe } = account;
 *     return safe;
 *   },
 * });
 * ctx.registerSource('accounts', accountsSource);
 * ```
 */
export function createAskableCollectionSource<TItem = unknown, TState = unknown>(
  options: AskableCreateCollectionSourceOptions<TItem, TState>,
): AskableContextSource {
  return {
    kind: options.kind ?? 'collection',
    describe: options.describe,
    getState: options.getState,
    resolve: async (request) => {
      const custom = await resolveCustomCollectionMode(options, request);
      if (custom !== undefined) return custom;
      if (!options.resolve) return undefined;
      return options.resolve(request);
    },
    sanitize: options.sanitize,
  };
}

async function resolveSourceValue<T>(value: AskableSourceValue<T>): Promise<T> {
  return typeof value === 'function'
    ? (value as () => T | Promise<T>)()
    : value;
}

function buildSourceResolver<TData, TState>(
  options: AskableCreateSourceOptions<TData, TState>,
): AskableContextSource['resolve'] {
  if (!options.modes && options.data === undefined) return undefined;

  return (request) => {
    const modeValue = options.modes?.[request.mode];
    if (modeValue !== undefined) {
      return resolveSourceData(modeValue, request);
    }
    if (options.data === undefined) return undefined;
    return resolveSourceData(options.data, request);
  };
}

function resolveSourceData<T>(
  value: T | AskableSourceResolver<T>,
  request: AskableContextSourceResolveRequest,
): T | Promise<T> {
  return typeof value === 'function'
    ? (value as AskableSourceResolver<T>)(request)
    : value;
}

async function resolveCustomCollectionMode<TItem, TState>(
  options: AskableCreateCollectionSourceOptions<TItem, TState>,
  request: AskableContextSourceResolveRequest,
): Promise<AskableCollectionSourceData<unknown> | unknown | undefined> {
  if (request.mode === 'summary' && options.getSummary) {
    return {
      mode: request.mode,
      summary: await options.getSummary(request),
    };
  }

  if (request.mode === 'visible' && options.getVisibleItems) {
    return collectionItemsResult(await options.getVisibleItems(), options, request);
  }

  if (request.mode === 'selected' && options.getSelectedItems) {
    return collectionItemsResult(await options.getSelectedItems(request), options, request);
  }

  if (request.mode === 'all' && options.getItems) {
    return collectionItemsResult(await options.getItems(), options, request);
  }

  if (request.mode === 'state') {
    return undefined;
  }

  return undefined;
}

async function collectionItemsResult<TItem>(
  items: readonly TItem[],
  options: AskableCreateCollectionSourceOptions<TItem>,
  request: AskableContextSourceResolveRequest,
): Promise<AskableCollectionSourceData<unknown>> {
  const maxItems = request.maxItems ?? options.maxItems;
  const capped = maxItems === undefined ? items : items.slice(0, Math.max(0, maxItems));
  let serialized: unknown[];
  if (options.sanitizeItem) {
    // async wrapper converts synchronous sanitizeItem throws into rejected promises
    const results = await Promise.allSettled(
      capped.map(async (item) => options.sanitizeItem!(item, request)),
    );
    serialized = results
      .filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled')
      .map((r) => r.value);
  } else {
    serialized = [...capped];
  }

  return {
    mode: request.mode,
    items: serialized,
    totalCount: items.length,
    returnedCount: serialized.length,
    truncated: serialized.length < items.length,
  };
}
