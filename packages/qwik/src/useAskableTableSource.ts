import { $ } from '@builder.io/qwik';
import type { QRL, SyncQRL } from '@builder.io/qwik';
import { createAskableCollectionSource } from '@askable-ui/core';
import type {
  AskableCollectionItemId,
  AskableContextSourceMode,
  AskableContextSourceResolveRequest,
  AskableCreateCollectionSourceOptions,
  AskableResolvedContextSource,
} from '@askable-ui/core';
import {
  useAskableSource,
  type AskableContextSourceFactory,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

type TableDescription = Extract<
  NonNullable<AskableCreateCollectionSourceOptions['describe']>,
  (...args: never[]) => unknown
>;

export interface UseAskableTableSourceOptions<TRow = unknown, TState = unknown>
  extends UseAskableSourceOptions,
    Omit<
      AskableCreateCollectionSourceOptions<TRow, TState>,
      | 'describe'
      | 'getState'
      | 'getItems'
      | 'getVisibleItems'
      | 'getSelectedItems'
      | 'getItemId'
      | 'getSelectionItemId'
      | 'getSummary'
      | 'resolve'
      | 'sanitizeItem'
      | 'sanitize'
    > {
  id?: string;
  /** QRL returning all rows. Legacy table-oriented alias for `getItems`. */
  rows?: QRL<() => readonly TRow[] | Promise<readonly TRow[]>>;
  /** QRL returning rows visible on screen. Alias for `getVisibleItems`. */
  visibleRows?: QRL<() => readonly TRow[] | Promise<readonly TRow[]>>;
  /** QRL returning selected rows. Alias for `getSelectedItems`. */
  selectedRows?: QRL<() => readonly TRow[] | Promise<readonly TRow[]>>;
  /** QRL returning table state. Alias for `getState`. */
  state?: QRL<() => TState | Promise<TState>>;
  /** Synchronous QRL returning a stable row identifier. Alias for `getItemId`. */
  getRowId?: SyncQRL<(
    row: TRow,
    request: AskableContextSourceResolveRequest,
  ) => AskableCollectionItemId | null | undefined>;
  /** Maximum rows included in resolutions. Defaults to 100. */
  maxRows?: number;
  /** QRL that redacts or transforms each row. Alias for `sanitizeItem`. */
  sanitizeRow?: QRL<(row: TRow) => unknown | Promise<unknown>>;

  /** Core-oriented aliases, supported in addition to the table API. */
  getState?: QRL<() => TState | Promise<TState>>;
  getItems?: QRL<() => readonly TRow[] | Promise<readonly TRow[]>>;
  getVisibleItems?: QRL<() => readonly TRow[] | Promise<readonly TRow[]>>;
  getSelectedItems?: QRL<(
    request: AskableContextSourceResolveRequest,
  ) => readonly TRow[] | Promise<readonly TRow[]>>;
  getItemId?: SyncQRL<(
    item: TRow,
    request: AskableContextSourceResolveRequest,
  ) => AskableCollectionItemId | null | undefined>;
  getSelectionItemId?: SyncQRL<(
    item: unknown,
    request: AskableContextSourceResolveRequest,
  ) => AskableCollectionItemId | null | undefined>;
  getSummary?: QRL<(request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>>;
  resolve?: QRL<(request: AskableContextSourceResolveRequest) => unknown | Promise<unknown>>;
  sanitizeItem?: QRL<(
    item: TRow,
    request: AskableContextSourceResolveRequest,
  ) => unknown | Promise<unknown>>;
  sanitize?: QRL<(
    source: AskableResolvedContextSource,
  ) => AskableResolvedContextSource | Promise<AskableResolvedContextSource>>;
  describe?: string | QRL<TableDescription>;
  kind?: string;
  advertisedModes?: readonly AskableContextSourceMode[];
  /** Advanced resume-safe factory for custom collection integrations. */
  source$?: AskableContextSourceFactory;
}

export interface UseAskableTableSourceResult extends UseAskableSourceResult {}

/**
 * Registers a table source with the established table aliases and defaults.
 * Provider callbacks are QRLs so the source can be reconstructed after resume.
 */
export function useAskableTableSource<TRow = unknown, TState = unknown>(
  options: UseAskableTableSourceOptions<TRow, TState> = {},
): UseAskableTableSourceResult {
  const {
    id = 'table',
    rows,
    visibleRows,
    selectedRows,
    state,
    getRowId,
    maxRows = 100,
    sanitizeRow,
    getState,
    getItems,
    getVisibleItems,
    getSelectedItems,
    getItemId,
    getSelectionItemId,
    getSummary,
    resolve,
    sanitizeItem,
    sanitize,
    maxItems,
    describe = 'Data table',
    kind = 'table',
    advertisedModes,
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
    source$,
  } = options;

  const items$ = getItems ?? rows;
  const visibleItems$ = getVisibleItems ?? visibleRows;
  const selectedItems$ = getSelectedItems ?? selectedRows;
  const state$ = getState ?? state;
  const itemId$ = getItemId ?? getRowId;
  const sanitizeItem$ = sanitizeItem ?? sanitizeRow;
  const defaultSourceFactory = $(async () => {
    const [
      resolvedState,
      resolvedItems,
      resolvedVisibleItems,
      resolvedSelectedItems,
      resolvedItemId,
      resolvedSelectionItemId,
      resolvedSummary,
      resolvedResolve,
      resolvedSanitizeItem,
      resolvedSanitize,
      resolvedDescribe,
    ] = await Promise.all([
      state$?.resolve(),
      items$?.resolve(),
      visibleItems$?.resolve(),
      selectedItems$?.resolve(),
      itemId$?.resolve(),
      getSelectionItemId?.resolve(),
      getSummary?.resolve(),
      resolve?.resolve(),
      sanitizeItem$?.resolve(),
      sanitize?.resolve(),
      typeof describe === 'string' ? describe : describe?.resolve(),
    ]);
    const resolvedDefaultSummary = resolvedSummary ?? (resolvedItems
      ? async (request: AskableContextSourceResolveRequest) => ({
          totalRows: (await resolvedItems()).length,
          visibleRows: resolvedVisibleItems ? (await resolvedVisibleItems()).length : undefined,
          selectedRows: resolvedSelectedItems
            ? (await resolvedSelectedItems(request)).length
            : undefined,
        })
      : undefined);

    return createAskableCollectionSource<TRow, TState>({
      kind,
      describe: resolvedDescribe,
      advertisedModes,
      maxItems: maxItems ?? maxRows,
      getState: resolvedState,
      getItems: resolvedItems,
      getVisibleItems: resolvedVisibleItems,
      getSelectedItems: resolvedSelectedItems,
      getItemId: resolvedItemId,
      getSelectionItemId: resolvedSelectionItemId,
      getSummary: resolvedDefaultSummary,
      resolve: resolvedResolve,
      sanitizeItem: resolvedSanitizeItem,
      sanitize: resolvedSanitize,
    });
  });

  return useAskableSource(
    id,
    source$ ?? defaultSourceFactory,
    {
      enabled, ctx, ctx$, name, events, viewport, textExtractor,
      sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
    },
  );
}
