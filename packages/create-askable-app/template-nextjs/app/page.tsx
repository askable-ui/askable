'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAskable, Askable } from '@askable-ui/react';

const ITEMS = [
  { label: 'Revenue', value: '$2.4M' },
  { label: 'Users', value: '18,400' },
  { label: 'Churn', value: '2.1%' },
];

export default function Page() {
  const { promptContext } = useAskable();
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    // Request-level options capture the current focus, not the initial render.
    void sendMessage({ text: input.trim() }, { body: { uiContext: promptContext } });
    setInput('');
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <main style={{ flex: 1 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>__APP_NAME__</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Click any card to see what the AI sees.</p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {ITEMS.map((item) => (
            <Askable key={item.label} as="article" meta={item}
              style={{ padding: '1.5rem 2rem', border: '1px solid #e5e7eb', borderRadius: 12,
                       background: '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{item.label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{item.value}</div>
            </Askable>
          ))}
        </div>
      </main>

      <aside style={{ width: 340, flexShrink: 0 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Ask AI</h2>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '1rem', minHeight: 200, maxHeight: 400, overflowY: 'auto' }}>
            {messages.map((m) => (
              <p key={m.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{m.role === 'user' ? 'You' : 'AI'}: </strong>
                {m.parts.map((part) => part.type === 'text' ? part.text : null)}
              </p>
            ))}
            {isLoading && <p>Thinking...</p>}
            {error && <p role="alert">Unable to complete the response. Please try again.</p>}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder="Ask about what you see..."
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 6 }}
            />
            <button type="submit" disabled={isLoading || !input.trim()} style={{ padding: '0.5rem 1rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Send
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
