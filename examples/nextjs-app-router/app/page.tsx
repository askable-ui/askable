'use client';

import { useChat } from 'ai/react';
import { useAskable, useAskableCompose, useAskableHistory, useAskableViewport, Askable } from '@askable-ui/react';

const KPIS = [
  { metric: 'Revenue', value: '$2.4M', delta: '+12%', trend: 'up' },
  { metric: 'Active Users', value: '18,400', delta: '+8%', trend: 'up' },
  { metric: 'Churn Rate', value: '2.1%', delta: '-0.3%', trend: 'down' },
  { metric: 'NPS', value: '72', delta: '+4', trend: 'up' },
];

export default function Page() {
  const { focus, promptContext: focusCtx } = useAskable();
  const { promptContext: historyCtx } = useAskableHistory();
  const { promptContext: viewportCtx } = useAskableViewport();
  const { promptContext } = useAskableCompose({
    sections: [
      { label: 'Focused element', value: focusCtx },
      { label: 'Navigation history', value: historyCtx },
      { label: 'Visible elements', value: viewportCtx },
    ],
  });

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: { uiContext: promptContext },
  });

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', fontFamily: 'system-ui' }}>
      <main style={{ flex: 1 }}>
        <h1>Analytics Dashboard</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {KPIS.map((kpi) => (
            <Askable key={kpi.metric} as="article" meta={kpi} scope="kpis"
              style={{ padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{kpi.metric}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpi.value}</div>
              <div style={{ color: kpi.trend === 'up' ? '#10b981' : '#ef4444' }}>{kpi.delta}</div>
            </Askable>
          ))}
        </div>

        <section>
          <h2>AI Context Preview</h2>
          <pre style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
            {promptContext}
          </pre>
        </section>
      </main>

      <aside style={{ width: 360, flexShrink: 0 }}>
        <h2>Ask AI</h2>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', minHeight: 200, maxHeight: 400, overflowY: 'auto' }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: '0.75rem' }}>
                <strong>{m.role === 'user' ? 'You' : 'AI'}: </strong>
                {m.content}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about what you see..."
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Send
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
