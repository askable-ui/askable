// @vitest-environment node
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useAskable } from '../useAskable.js';

function Consumer() {
  const { promptContext } = useAskable();
  return React.createElement('div', null, promptContext);
}

describe('useAskable SSR', () => {
  it('renders without touching document during SSR', () => {
    expect(() => renderToString(React.createElement(Consumer))).not.toThrow();
  });
});
