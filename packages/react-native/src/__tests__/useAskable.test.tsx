import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAskable, useAskableScreen, useAskableScrollView, useAskableVisibility } from '../index';
import type { AskableContext } from '@askable-ui/core';

describe('useAskable (React Native)', () => {
  it('returns null focus initially', () => {
    let seenFocus: unknown = Symbol('unset');

    function Consumer() {
      const { focus } = useAskable();
      seenFocus = focus;
      return null;
    }

    TestRenderer.create(<Consumer />);
    expect(seenFocus).toBeNull();
  });

  it('returns a context with push-based focus updates', () => {
    let seenCtx: AskableContext | null = null;
    let seenFocus: unknown = null;

    function Consumer() {
      const { ctx, focus } = useAskable();
      seenCtx = ctx;
      seenFocus = focus;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      seenCtx!.push({ screen: 'analytics-card' }, 'Revenue card');
    });

    expect(seenFocus).toMatchObject({
      meta: { screen: 'analytics-card' },
      text: 'Revenue card',
      source: 'push',
    });
  });

  it('pushes active screen context into the shared askable context', () => {
    let seenCtx: AskableContext | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      useAskableScreen({
        ctx,
        meta: { screen: 'RevenueScreen' },
        text: 'Revenue screen',
        active: true,
      });
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { screen: 'RevenueScreen' },
      text: 'Revenue screen',
      source: 'push',
    });
  });

  it('clears screen context when the screen becomes inactive', () => {
    let seenCtx: AskableContext | null = null;
    let renderer: TestRenderer.ReactTestRenderer;

    function Consumer({ active }: { active: boolean }) {
      const { ctx } = useAskable();
      seenCtx = ctx;
      useAskableScreen({
        ctx,
        meta: { screen: 'RevenueScreen' },
        text: 'Revenue screen',
        active,
      });
      return null;
    }

    act(() => {
      renderer = TestRenderer.create(<Consumer active={true} />);
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { screen: 'RevenueScreen' },
      text: 'Revenue screen',
      source: 'push',
    });

    act(() => {
      renderer!.update(<Consumer active={false} />);
    });

    expect(seenCtx!.getFocus()).toBeNull();
  });

  it('pushes the first visible item from viewability updates into the shared askable context', () => {
    let seenCtx: AskableContext | null = null;
    let onViewableItemsChanged: ((info: { viewableItems: Array<{ item: unknown; index?: number | null; isViewable?: boolean }> }) => void) | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      onViewableItemsChanged = useAskableVisibility({
        ctx,
        getMeta: (item) => ({ productId: (item as { id: string }).id }),
        getText: (item) => (item as { title: string }).title,
      }).onViewableItemsChanged;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      onViewableItemsChanged!({
        viewableItems: [
          { item: { id: 'p-1', title: 'Revenue Dashboard' }, index: 0, isViewable: true },
          { item: { id: 'p-2', title: 'Pipeline Summary' }, index: 1, isViewable: true },
        ],
      });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { productId: 'p-1' },
      text: 'Revenue Dashboard',
      source: 'push',
    });
  });

  it('clears visibility context when no items remain visible', () => {
    let seenCtx: AskableContext | null = null;
    let onViewableItemsChanged: ((info: { viewableItems: Array<{ item: unknown; index?: number | null; isViewable?: boolean }> }) => void) | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      onViewableItemsChanged = useAskableVisibility({
        ctx,
        getMeta: (item) => ({ productId: (item as { id: string }).id }),
        getText: (item) => (item as { title: string }).title,
      }).onViewableItemsChanged;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      onViewableItemsChanged!({
        viewableItems: [{ item: { id: 'p-1', title: 'Revenue Dashboard' }, index: 0, isViewable: true }],
      });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { productId: 'p-1' },
      text: 'Revenue Dashboard',
      source: 'push',
    });

    act(() => {
      onViewableItemsChanged!({ viewableItems: [] });
    });

    expect(seenCtx!.getFocus()).toBeNull();
  });

  it('ignores visibility updates while inactive and clears existing focus on blur by default', () => {
    let seenCtx: AskableContext | null = null;
    let onViewableItemsChanged: ((info: { viewableItems: Array<{ item: unknown; index?: number | null; isViewable?: boolean }> }) => void) | null = null;
    let renderer: TestRenderer.ReactTestRenderer;

    function Consumer({ active }: { active: boolean }) {
      const { ctx } = useAskable();
      seenCtx = ctx;
      onViewableItemsChanged = useAskableVisibility({
        ctx,
        active,
        getMeta: (item) => ({ productId: (item as { id: string }).id }),
        getText: (item) => (item as { title: string }).title,
      }).onViewableItemsChanged;
      return null;
    }

    act(() => {
      renderer = TestRenderer.create(<Consumer active={true} />);
    });

    act(() => {
      onViewableItemsChanged!({
        viewableItems: [{ item: { id: 'p-1', title: 'Revenue Dashboard' }, index: 0, isViewable: true }],
      });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { productId: 'p-1' },
      text: 'Revenue Dashboard',
      source: 'push',
    });

    act(() => {
      renderer!.update(<Consumer active={false} />);
    });

    expect(seenCtx!.getFocus()).toBeNull();

    act(() => {
      onViewableItemsChanged!({
        viewableItems: [{ item: { id: 'p-2', title: 'Pipeline Summary' }, index: 1, isViewable: true }],
      });
    });

    expect(seenCtx!.getFocus()).toBeNull();
  });

  it('pushes the top visible ScrollView item into the shared askable context', () => {
    let seenCtx: AskableContext | null = null;
    let onScroll: ((event: { nativeEvent: { contentOffset?: { y?: number }; layoutMeasurement?: { height?: number } } }) => void) | null = null;
    let measureItem: ((key: string, item: { id: string; title: string }, layout: { y: number; height: number }) => void) | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      const tracker = useAskableScrollView({
        ctx,
        getMeta: (item) => ({ insightId: item.id }),
        getText: (item) => item.title,
      });
      onScroll = tracker.onScroll;
      measureItem = tracker.measureItem;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      measureItem!('a', { id: 'a', title: 'Revenue Insight' }, { y: 0, height: 120 });
      measureItem!('b', { id: 'b', title: 'Pipeline Insight' }, { y: 140, height: 120 });
      onScroll!({ nativeEvent: { contentOffset: { y: 20 }, layoutMeasurement: { height: 160 } } });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { insightId: 'a' },
      text: 'Revenue Insight',
      source: 'push',
    });
  });

  it('updates ScrollView context as the viewport moves between measured items', () => {
    let seenCtx: AskableContext | null = null;
    let onScroll: ((event: { nativeEvent: { contentOffset?: { y?: number }; layoutMeasurement?: { height?: number } } }) => void) | null = null;
    let measureItem: ((key: string, item: { id: string; title: string }, layout: { y: number; height: number }) => void) | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      const tracker = useAskableScrollView({
        ctx,
        getMeta: (item) => ({ insightId: item.id }),
        getText: (item) => item.title,
      });
      onScroll = tracker.onScroll;
      measureItem = tracker.measureItem;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      measureItem!('a', { id: 'a', title: 'Revenue Insight' }, { y: 0, height: 120 });
      measureItem!('b', { id: 'b', title: 'Pipeline Insight' }, { y: 140, height: 120 });
      onScroll!({ nativeEvent: { contentOffset: { y: 20 }, layoutMeasurement: { height: 140 } } });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { insightId: 'a' },
      text: 'Revenue Insight',
      source: 'push',
    });

    act(() => {
      onScroll!({ nativeEvent: { contentOffset: { y: 150 }, layoutMeasurement: { height: 140 } } });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { insightId: 'b' },
      text: 'Pipeline Insight',
      source: 'push',
    });
  });

  it('clears ScrollView context when no measured item intersects the viewport', () => {
    let seenCtx: AskableContext | null = null;
    let onScroll: ((event: { nativeEvent: { contentOffset?: { y?: number }; layoutMeasurement?: { height?: number } } }) => void) | null = null;
    let measureItem: ((key: string, item: { id: string; title: string }, layout: { y: number; height: number }) => void) | null = null;

    function Consumer() {
      const { ctx } = useAskable();
      seenCtx = ctx;
      const tracker = useAskableScrollView({
        ctx,
        getMeta: (item) => ({ insightId: item.id }),
        getText: (item) => item.title,
      });
      onScroll = tracker.onScroll;
      measureItem = tracker.measureItem;
      return null;
    }

    act(() => {
      TestRenderer.create(<Consumer />);
    });

    act(() => {
      measureItem!('a', { id: 'a', title: 'Revenue Insight' }, { y: 0, height: 120 });
      onScroll!({ nativeEvent: { contentOffset: { y: 10 }, layoutMeasurement: { height: 100 } } });
    });

    expect(seenCtx!.getFocus()).toMatchObject({
      meta: { insightId: 'a' },
      text: 'Revenue Insight',
      source: 'push',
    });

    act(() => {
      onScroll!({ nativeEvent: { contentOffset: { y: 400 }, layoutMeasurement: { height: 100 } } });
    });

    expect(seenCtx!.getFocus()).toBeNull();
  });
});
