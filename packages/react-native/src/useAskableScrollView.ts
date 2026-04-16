import { useCallback, useEffect, useRef, useState } from 'react';
import { createAskableContext } from '@askable-ui/core';
import type { AskableContext, AskableContextOptions } from '@askable-ui/core';

export interface AskableScrollLayout {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface AskableScrollNativeEvent {
  contentOffset?: {
    x?: number;
    y?: number;
  };
  layoutMeasurement?: {
    width?: number;
    height?: number;
  };
}

export interface AskableScrollEvent {
  nativeEvent: AskableScrollNativeEvent;
}

export interface AskableMeasuredItem<Item = unknown> {
  key: string;
  item: Item;
  layout: AskableScrollLayout;
}

export interface AskableVisibleScrollItem<Item = unknown> extends AskableMeasuredItem<Item> {
  viewportTop: number;
  viewportBottom: number;
}

export interface UseAskableScrollViewOptions<Item = unknown> extends AskableContextOptions {
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Whether scroll updates should currently affect the context. */
  active?: boolean;
  /** Whether to clear the context when tracking becomes inactive. */
  clearOnBlur?: boolean;
  /** Map a visible item into the metadata pushed into askable. */
  getMeta: (item: Item, measured: AskableMeasuredItem<Item>) => Record<string, unknown> | string;
  /** Optional label stored alongside the visible item metadata. */
  getText?: (item: Item, measured: AskableMeasuredItem<Item>) => string;
  /** Pick which visible measured item should win focus. Defaults to the top-most visible item. */
  selectVisible?: (items: AskableVisibleScrollItem<Item>[]) => AskableVisibleScrollItem<Item> | null;
}

export interface UseAskableScrollViewResult<Item = unknown> {
  ctx: AskableContext;
  onScroll: (event: AskableScrollEvent) => void;
  measureItem: (key: string, item: Item, layout: AskableScrollLayout) => void;
  unmeasureItem: (key: string) => void;
  clearVisibleItem: () => void;
  createOnItemLayout: (
    key: string,
    item: Item
  ) => (event: { nativeEvent?: { layout?: AskableScrollLayout } }) => void;
}

function getNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function defaultSelectVisible<Item>(
  items: AskableVisibleScrollItem<Item>[]
): AskableVisibleScrollItem<Item> | null {
  return items[0] ?? null;
}

export function useAskableScrollView<Item = unknown>(
  options: UseAskableScrollViewOptions<Item>
): UseAskableScrollViewResult<Item> {
  const {
    active = true,
    clearOnBlur = true,
    ctx,
    getMeta,
    getText,
    selectVisible = defaultSelectVisible,
  } = options;
  const [scrollCtx] = useState<AskableContext>(() => ctx ?? createAskableContext(options));
  const measuredItemsRef = useRef<Map<string, AskableMeasuredItem<Item>>>(new Map());
  const viewportRef = useRef<{ offsetY: number; height: number } | null>(null);

  const clearVisibleItem = useCallback(() => {
    scrollCtx.clear();
  }, [scrollCtx]);

  const syncVisibleItem = useCallback(() => {
    if (!active) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const viewportTop = viewport.offsetY;
    const viewportBottom = viewport.offsetY + viewport.height;

    const visibleItems = Array.from(measuredItemsRef.current.values())
      .filter((entry) => {
        const top = getNumber(entry.layout.y);
        const bottom = top + Math.max(getNumber(entry.layout.height), 0);
        return bottom > viewportTop && top < viewportBottom;
      })
      .sort((left, right) => getNumber(left.layout.y) - getNumber(right.layout.y))
      .map((entry) => ({
        ...entry,
        viewportTop,
        viewportBottom,
      }));

    const selected = selectVisible(visibleItems);
    if (!selected) {
      clearVisibleItem();
      return;
    }

    scrollCtx.push(getMeta(selected.item, selected), getText?.(selected.item, selected) ?? '');
  }, [active, clearVisibleItem, getMeta, getText, scrollCtx, selectVisible]);

  const onScroll = useCallback(
    (event: AskableScrollEvent) => {
      const nativeEvent = event?.nativeEvent ?? {};
      viewportRef.current = {
        offsetY: getNumber(nativeEvent.contentOffset?.y),
        height: Math.max(getNumber(nativeEvent.layoutMeasurement?.height), 0),
      };
      syncVisibleItem();
    },
    [syncVisibleItem]
  );

  const measureItem = useCallback(
    (key: string, item: Item, layout: AskableScrollLayout) => {
      measuredItemsRef.current.set(key, { key, item, layout });
      syncVisibleItem();
    },
    [syncVisibleItem]
  );

  const unmeasureItem = useCallback(
    (key: string) => {
      measuredItemsRef.current.delete(key);
      syncVisibleItem();
    },
    [syncVisibleItem]
  );

  const createOnItemLayout = useCallback(
    (key: string, item: Item) => (event: { nativeEvent?: { layout?: AskableScrollLayout } }) => {
      measureItem(key, item, event?.nativeEvent?.layout ?? {});
    },
    [measureItem]
  );

  useEffect(() => {
    if (!active && clearOnBlur) {
      scrollCtx.clear();
    }
  }, [active, clearOnBlur, scrollCtx]);

  useEffect(() => {
    return () => {
      measuredItemsRef.current.clear();
      if (!ctx) {
        scrollCtx.destroy();
      }
    };
  }, [ctx, scrollCtx]);

  return {
    ctx: scrollCtx,
    onScroll,
    measureItem,
    unmeasureItem,
    clearVisibleItem,
    createOnItemLayout,
  };
}
