import { createSignal, For, Show } from 'solid-js';
import { Askable, useAskable, useAskableAgent } from '@askable-ui/solid';

const ITEMS = [
  { label: 'Revenue', value: '$2.4M', delta: '+12%' },
  { label: 'Users', value: '18,400', delta: '+8%' },
  { label: 'Churn', value: '2.1%', delta: '-0.3%' },
];

export default function App() {
  const { focus, promptContext } = useAskable();
  const { send, status } = useAskableAgent();
  const [response, setResponse] = createSignal('');

  async function handleAsk() {
    setResponse('');
    const result = await send('What is this metric and what does it mean?', async (req) => {
      // Replace with your actual API call:
      // const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) });
      // return res.json();

      // Demo: echo the context back
      return `Context received (${req.context.length} chars). Connect /api/chat to get real AI responses.`;
    });
    if (result) setResponse(String(result));
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', 'max-width': '1200px', margin: '0 auto', 'font-family': 'system-ui' }}>
      <main style={{ flex: 1 }}>
        <h1 style={{ 'font-size': '1.5rem', 'margin-bottom': '0.5rem' }}>__APP_NAME__</h1>
        <p style={{ color: '#6b7280', 'margin-bottom': '1.5rem' }}>Click any card, then ask AI about it.</p>

        <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'margin-bottom': '1.5rem' }}>
          <For each={ITEMS}>{(item) => (
            <Askable
              as="article"
              meta={item}
              style={{
                padding: '1.5rem 2rem',
                border: `2px solid ${focus()?.meta && typeof focus()?.meta === 'object' && (focus()!.meta as Record<string, unknown>).label === item.label ? '#6366f1' : '#e5e7eb'}`,
                'border-radius': '12px',
                background: focus()?.meta && typeof focus()?.meta === 'object' && (focus()!.meta as Record<string, unknown>).label === item.label ? '#f5f3ff' : '#fff',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                display: 'flex',
                'flex-direction': 'column',
                gap: '0.25rem',
              }}
            >
              <span style={{ 'font-size': '0.875rem', color: '#6b7280' }}>{item.label}</span>
              <span style={{ 'font-size': '1.75rem', 'font-weight': '700' }}>{item.value}</span>
            </Askable>
          )}</For>
        </div>

        <Show when={response()}>
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', 'border-radius': '8px', padding: '1rem', 'font-size': '0.875rem' }}>
            <strong>AI: </strong>{response()}
          </div>
        </Show>
      </main>

      <aside style={{ width: '340px', 'flex-shrink': 0 }}>
        <h2 style={{ 'font-size': '1rem', 'font-weight': '600', 'margin-bottom': '0.75rem' }}>Ask AI</h2>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
          <pre style={{ background: '#f3f4f6', 'border-radius': '8px', padding: '1rem', 'font-size': '0.75rem', 'white-space': 'pre-wrap', 'min-height': '120px' }}>
            {promptContext() || 'Click a card to see AI context'}
          </pre>
          <button
            style={{
              padding: '0.625rem 1.25rem',
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              'border-radius': '8px',
              'font-size': '0.875rem',
              'font-weight': '500',
              cursor: status() === 'pending' || !promptContext() ? 'not-allowed' : 'pointer',
              opacity: status() === 'pending' || !promptContext() ? 0.5 : 1,
            }}
            disabled={status() === 'pending' || !promptContext()}
            onClick={handleAsk}
          >
            {status() === 'pending' ? 'Thinking…' : 'Ask AI about this'}
          </button>
          <Show when={status() === 'error'}>
            <p style={{ color: '#ef4444', 'font-size': '0.875rem' }}>Request failed — check console</p>
          </Show>
        </div>
      </aside>
    </div>
  );
}
