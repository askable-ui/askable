import { render, act } from '@testing-library/react';
import { createAskableContext } from '@askable-ui/core';
import { useAskableHistory } from '../useAskableHistory.js';

function HistoryConsumer({ ctx }: { ctx: ReturnType<typeof createAskableContext> }) {
  const { history, current, promptContext } = useAskableHistory({ ctx });
  return (
    <div>
      <span data-testid="count">{history.length}</span>
      <span data-testid="current">{current ? JSON.stringify(current.meta) : 'null'}</span>
      <span data-testid="prompt">{promptContext}</span>
      {history.map((item, i) => (
        <span key={i} data-testid={`entry-${i}`}>{JSON.stringify(item.meta)}</span>
      ))}
    </div>
  );
}

describe('useAskableHistory', () => {
  it('starts with empty history', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);
    expect(getByTestId('count').textContent).toBe('0');
    expect(getByTestId('current').textContent).toBe('null');
    ctx.destroy();
  });

  it('returns the empty-state prompt initially', () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);
    expect(getByTestId('prompt').textContent).toBe('No navigation history yet.');
    ctx.destroy();
  });

  it('records focus events as history entries', async () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);

    await act(async () => {
      ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    });

    expect(getByTestId('count').textContent).toBe('1');
    expect(getByTestId('current').textContent).toContain('revenue');
    ctx.destroy();
  });

  it('appends newest entry at the front', async () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);

    await act(async () => {
      ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' });
    });
    await act(async () => {
      ctx.push({ meta: { id: 'churn' }, text: 'Churn' });
    });

    expect(getByTestId('count').textContent).toBe('2');
    expect(getByTestId('entry-0').textContent).toContain('churn');
    expect(getByTestId('entry-1').textContent).toContain('revenue');
    ctx.destroy();
  });

  it('deduplicates consecutive identical entries by default', async () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);

    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });
    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });

    expect(getByTestId('count').textContent).toBe('1');
    ctx.destroy();
  });

  it('does not deduplicate when dedupe=false', async () => {
    const ctx = createAskableContext();

    function NoDedupe() {
      const { history } = useAskableHistory({ ctx, dedupe: false });
      return <span data-testid="count">{history.length}</span>;
    }

    const { getByTestId } = render(<NoDedupe />);

    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });
    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });

    expect(getByTestId('count').textContent).toBe('2');
    ctx.destroy();
  });

  it('caps history at maxEntries', async () => {
    const ctx = createAskableContext();

    function Capped() {
      const { history } = useAskableHistory({ ctx, maxEntries: 3, dedupe: false });
      return <span data-testid="count">{history.length}</span>;
    }

    const { getByTestId } = render(<Capped />);

    await act(async () => {
      for (let i = 0; i < 5; i++) {
        ctx.push({ meta: { id: `item-${i}` }, text: `Item ${i}` });
      }
    });

    expect(getByTestId('count').textContent).toBe('3');
    ctx.destroy();
  });

  it('resets current to null on ctx.clear()', async () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);

    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });
    expect(getByTestId('current').textContent).toContain('revenue');

    await act(async () => { ctx.clear(); });
    expect(getByTestId('current').textContent).toBe('null');
    ctx.destroy();
  });

  it('builds a prompt trail string', async () => {
    const ctx = createAskableContext();
    const { getByTestId } = render(<HistoryConsumer ctx={ctx} />);

    await act(async () => { ctx.push({ meta: { id: 'revenue' }, text: 'Revenue' }); });
    await act(async () => { ctx.push({ meta: { id: 'churn' }, text: 'Churn' }); });

    const prompt = getByTestId('prompt').textContent ?? '';
    expect(prompt).toContain('User navigation trail');
    expect(prompt).toContain('churn');
    expect(prompt).toContain('revenue');
    ctx.destroy();
  });
});
