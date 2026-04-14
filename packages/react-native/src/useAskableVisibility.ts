import { useCallback, useEffect, useState } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions } from '@askable-ui/core';

export interface AskableViewToken<Item = unknown> {
  item?: Item;
  key?: string | null;
  index?: number | null;
  isViewable?: boolean;
  section?: unknown;
}

export interface AskableViewabilityInfo<Item = unknown> {
  viewableItems: AskableViewToken<Item>[];
  changed?: AskableViewToken<Item>[];
}

export interface UseAskableVisibilityOptions<Item = unknown> extends AskableContextOptions {
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Whether visibility updates should currently affect the context. */
  active?: boolean;
  /** Whether to clear the context when visibility tracking becomes inactive. */
  clearOnBlur?: boolean;
  /** Map a visible item into the metadata pushed into askable. */
  getMeta: (item: Item, token: AskableViewToken<Item>) => Record<string, unknown> | string;
  /** Optional label stored alongside the visible item metadata. */
  getText?: (item: Item, token: AskableViewToken<Item>) => string;
  /** Pick which currently visible item should win focus. Defaults to the first viewable item. */
  selectViewable?: (tokens: AskableViewToken<Item>[]) => AskableViewToken<Item> | null;
}

export interface UseAskableVisibilityResult<Item = unknown> {
  ctx: AskableContext;
  onViewableItemsChanged: (info: AskableViewabilityInfo<Item>) => void;
  clearVisibleItem: () => void;
}

function defaultSelectViewable<Item>(tokens: AskableViewToken<Item>[]): AskableViewToken<Item> | null {
  return tokens.find((token) => token.item !== undefined && token.isViewable !== false) ?? null;
}

export function useAskableVisibility<Item = unknown>(
  options: UseAskableVisibilityOptions<Item>
): UseAskableVisibilityResult<Item> {
  const {
    active = true,
    clearOnBlur = true,
    ctx,
    getMeta,
    getText,
    selectViewable = defaultSelectViewable,
  } = options;
  const [visibilityCtx] = useState<AskableContext>(() => ctx ?? createAskableContext(options));

  const clearVisibleItem = useCallback(() => {
    visibilityCtx.clear();
  }, [visibilityCtx]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: AskableViewabilityInfo<Item>) => {
      if (!active) {
        return;
      }

      const selected = selectViewable(viewableItems);
      if (!selected || selected.item === undefined) {
        clearVisibleItem();
        return;
      }

      const item = selected.item;
      visibilityCtx.push(getMeta(item, selected), getText?.(item, selected) ?? '');
    },
    [active, clearVisibleItem, getMeta, getText, selectViewable, visibilityCtx]
  );

  useEffect(() => {
    if (!active && clearOnBlur) {
      visibilityCtx.clear();
    }
  }, [active, clearOnBlur, visibilityCtx]);

  useEffect(() => {
    return () => {
      if (!ctx) {
        visibilityCtx.destroy();
      }
    };
  }, [ctx, visibilityCtx]);

  return {
    ctx: visibilityCtx,
    onViewableItemsChanged,
    clearVisibleItem,
  };
}
