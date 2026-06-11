'use client';

import { useRef, useState } from 'react';
import {
  Askable,
  useAskable,
  useAskableCompose,
  useAskableHistory,
  useAskableViewport,
  useAskableChat,
} from '@askable-ui/react';

const KPIS = [
  { metric: 'Revenue', value: '$2.4M', delta: '+12%', trend: 'up' },
  { metric: 'Active Users', value: '18,400', delta: '+8%', trend: 'up' },
  { metric: 'Churn Rate', value: '2.1%', delta: '-0.3%', trend: 'down' },
  { metric: 'NPS', value: '72', delta: '+4', trend: 'up' },
];

export default function Page() {
  const { promptContext: focusCtx } = useAskable();
  const { promptContext: historyCtx } = useAskableHistory();
  const { promptContext: viewportCtx } = useAskableViewport();
  const { promptContext } = useAskableCompose({
    sections: [
      { label: 'Focused element', value: focusCtx },
      { label: 'Navigation history', value: historyCtx },
      { label: 'Visible elements', value: viewportCtx },
    ],
  });

  const { messages, append, isStreaming, clearMessages } = useAskableChat({
    systemPrompt: (ctx) =>
      `You are a helpful analytics assistant embedded in a dashboard.\n\n${ctx}`,
  });

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const question = input.trim();
    setInput('');

    await append(question, async (req, msgs, emit) => {
      const res = await fetch('/api/askable-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: req.question,
          context: req.context,
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        emit(value);
      }
    });
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', fontFamily: 'system-ui' }}>
      <main style={{ flex: 1 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Analytics Dashboard</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Click any card — the AI sidebar will see exactly what you clicked.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {KPIS.map((kpi) => (
            <Askable
              key={kpi.metric}
              as="article"
              meta={kpi}
              scope="kpis"
              style={{
                padding: '1.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{kpi.metric}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpi.value}</div>
              <div style={{ color: kpi.trend === 'up' ? '#10b981' : '#ef4444', fontSize: '0.875rem' }}>
                {kpi.delta}
              </div>
            </Askable>
          ))}
        </div>

        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Live AI Context
          </h2>
          <pre
            style={{
              background: '#f3f4f6',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              minHeight: '80px',
              color: '#374151',
            }}
          >
            {promptContext || '(click a card to populate)'}
          </pre>
        </section>
      </main>

      <aside style={{ width: 360, flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Ask AI</h2>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: 480,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', marginTop: '2rem' }}>
                Click a metric card, then ask a question.
              </p>
            )}
            {messages.filter(m => m.role !== 'system').map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  maxWidth: '90%',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  ...(m.role === 'user'
                    ? { background: '#6366f1', color: '#fff', alignSelf: 'flex-end' }
                    : { background: '#f3f4f6', alignSelf: 'flex-start' }),
                }}
              >
                {m.content || (isStreaming ? '…' : '')}
              </div>
            ))}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '1rem',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about what you see…"
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              style={{
                padding: '0.5rem 1rem',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                opacity: isStreaming || !input.trim() ? 0.5 : 1,
              }}
            >
              {isStreaming ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
