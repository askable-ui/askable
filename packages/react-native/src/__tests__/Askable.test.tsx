import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createAskableContext } from '@askable-ui/core';
import { Askable } from '../Askable';

describe('Askable (React Native)', () => {
  it('injects onPress and preserves the child handler', () => {
    const ctx = createAskableContext();
    const onPress = vi.fn();
    const tree = TestRenderer.create(
      <Askable ctx={ctx} meta={{ widget: 'revenue' }} text="Revenue card">
        {React.createElement('Pressable', { onPress, testID: 'pressable' })}
      </Askable>
    );

    const pressable = tree.root.findByProps({ testID: 'pressable' });

    act(() => {
      pressable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledOnce();
    expect(ctx.getFocus()).toMatchObject({
      meta: { widget: 'revenue' },
      text: 'Revenue card',
      source: 'push',
    });

    ctx.destroy();
  });

  it('supports onLongPress as a focus trigger', () => {
    const ctx = createAskableContext();
    const tree = TestRenderer.create(
      <Askable ctx={ctx} meta="details" text="Details sheet">
        {React.createElement('Pressable', { testID: 'pressable' })}
      </Askable>
    );

    const pressable = tree.root.findByProps({ testID: 'pressable' });

    act(() => {
      pressable.props.onLongPress();
    });

    expect(ctx.getFocus()).toMatchObject({
      meta: 'details',
      text: 'Details sheet',
      source: 'push',
    });

    ctx.destroy();
  });

  it('pushes scoped focus when scope is provided', () => {
    const ctx = createAskableContext();
    const tree = TestRenderer.create(
      <Askable ctx={ctx} meta={{ widget: 'revenue' }} text="Revenue card" scope="analytics">
        {React.createElement('Pressable', { testID: 'pressable' })}
      </Askable>
    );

    const pressable = tree.root.findByProps({ testID: 'pressable' });

    act(() => {
      pressable.props.onPress();
    });

    expect(ctx.getFocus()).toMatchObject({
      meta: { widget: 'revenue' },
      text: 'Revenue card',
      scope: 'analytics',
      source: 'push',
    });

    ctx.destroy();
  });

  it('supports nested Askable wrappers by pushing ancestor hierarchy', () => {
    const ctx = createAskableContext();
    const tree = TestRenderer.create(
      <Askable ctx={ctx} meta={{ view: 'dashboard' }} text="Dashboard" scope="analytics">
        <Askable ctx={ctx} meta={{ tab: 'finance' }} text="Finance" scope="analytics">
          <Askable ctx={ctx} meta={{ metric: 'revenue' }} text="Revenue card" scope="analytics">
            {React.createElement('Pressable', { testID: 'pressable' })}
          </Askable>
        </Askable>
      </Askable>
    );

    const pressable = tree.root.findByProps({ testID: 'pressable' });

    act(() => {
      pressable.props.onPress();
    });

    expect(ctx.getFocus()).toMatchObject({
      meta: { metric: 'revenue' },
      text: 'Revenue card',
      scope: 'analytics',
      ancestors: [
        { meta: { view: 'dashboard' }, scope: 'analytics', text: 'Dashboard' },
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'Finance' },
      ],
      source: 'push',
    });
    expect(ctx.toPromptContext()).toContain('view: dashboard > tab: finance > metric: revenue');
    expect((ctx as any).serializeFocus({ hierarchyDepth: 1 })).toEqual({
      meta: { metric: 'revenue' },
      scope: 'analytics',
      ancestors: [
        { meta: { tab: 'finance' }, scope: 'analytics', text: 'Finance' },
      ],
      text: 'Revenue card',
      timestamp: expect.any(Number),
    });

    ctx.destroy();
  });
});
