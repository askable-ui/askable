import { render } from '@testing-library/react';
import { useAskableCompose } from '../useAskableCompose.js';

function Compose({ sections }: { sections: { label: string; value: string | null | undefined }[] }) {
  const { promptContext } = useAskableCompose({ sections });
  return <span data-testid="out">{promptContext}</span>;
}

describe('useAskableCompose', () => {
  it('returns fallback when all sections are empty', () => {
    const { getByTestId } = render(
      <Compose sections={[{ label: 'Focus', value: '' }, { label: 'History', value: null }]} />,
    );
    expect(getByTestId('out').textContent).toBe('No UI context available.');
  });

  it('includes non-empty sections with label headers', () => {
    const { getByTestId } = render(
      <Compose sections={[{ label: 'Focus', value: 'Revenue metric' }]} />,
    );
    const text = getByTestId('out').textContent ?? '';
    expect(text).toContain('Focus:');
    expect(text).toContain('Revenue metric');
  });

  it('omits null and empty sections', () => {
    const { getByTestId } = render(
      <Compose
        sections={[
          { label: 'Focus', value: 'Revenue' },
          { label: 'Empty', value: null },
          { label: 'Whitespace', value: '   ' },
          { label: 'History', value: 'Trail' },
        ]}
      />,
    );
    const text = getByTestId('out').textContent ?? '';
    expect(text).not.toContain('Empty:');
    expect(text).not.toContain('Whitespace:');
    expect(text).toContain('Focus:');
    expect(text).toContain('History:');
  });

  it('joins sections with double newline separator by default', () => {
    const { getByTestId } = render(
      <Compose
        sections={[
          { label: 'A', value: 'first' },
          { label: 'B', value: 'second' },
        ]}
      />,
    );
    const text = getByTestId('out').textContent ?? '';
    expect(text).toContain('A:\nfirst\n\nB:\nsecond');
  });

  it('respects custom emptyFallback', () => {
    function WithFallback() {
      const { promptContext } = useAskableCompose({
        sections: [{ label: 'X', value: null }],
        emptyFallback: 'Nothing here.',
      });
      return <span data-testid="out">{promptContext}</span>;
    }
    const { getByTestId } = render(<WithFallback />);
    expect(getByTestId('out').textContent).toBe('Nothing here.');
  });
});
