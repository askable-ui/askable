// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { useAskableFocusSource } from '../useAskableFocusSource.js';

describe('useAskableFocusSource SSR', () => {
  it('renders a deterministic no-focus snapshot without browser globals', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');

    function Consumer() {
      const { snapshot } = useAskableFocusSource();
      expect(snapshot).toEqual({
        focused: null,
        hasFocus: false,
        focusChangeCount: 0,
        lastChangedAt: null,
      });
      return <span>{snapshot?.hasFocus ? 'focused' : 'unfocused'}</span>;
    }

    expect(renderToString(<Consumer />)).toBe('<span>unfocused</span>');
    expect(renderToString(<Consumer />)).toBe('<span>unfocused</span>');
  });
});
