import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAskable } from '../useAskable';
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
});
