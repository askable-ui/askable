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
});
