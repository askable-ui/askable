import React, { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Askable, useAskable } from '@askable-ui/react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function App() {
  const { promptContext, focus, ctx } = useAskable({ events: ['click'] });
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const revenueRef = useRef<HTMLDivElement>(null);
  const churnRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);

  const starterPrompt = useMemo(() => {
    if (!focus) return 'Click a card or use an Ask AI button to capture UI context.';
    return `Explain what stands out here and what I should investigate next.\n\n${promptContext}`;
  }, [focus, promptContext]);

  function openAskAI(target: HTMLElement | null, question: string) {
    if (target) ctx.select(target);
    setIsPanelOpen(true);
    setMessages([
      { role: 'user', content: question },
      {
        role: 'assistant',
        content:
          'This is a demo chat shell. In a full CopilotKit or AI SDK integration, the captured Askable prompt context would be sent with the user question here.',
      },
    ]);
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Askable + copilot example</h1>
        <p style={{ color: '#555', maxWidth: 760 }}>
          This example shows a realistic explicit Ask AI flow: select a UI region, open a side panel,
          and carry Askable context into the assistant layer.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 20, alignItems: 'start' }}>
        <main>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <Askable meta={{ widget: 'revenue-card', period: 'Q3', value: '$2.3M', delta: '-12%' }} ref={revenueRef}>
              <MetricCard
                title="Revenue"
                value="$2.3M"
                detail="Down 12% vs last quarter"
                onAskAI={() => openAskAI(revenueRef.current, 'Why is revenue dropping?')}
              />
            </Askable>

            <Askable meta={{ widget: 'churn-card', segment: 'SMB', value: '4.2%', delta: '+0.8pp' }} ref={churnRef}>
              <MetricCard
                title="Churn"
                value="4.2%"
                detail="Up 0.8 percentage points"
                onAskAI={() => openAskAI(churnRef.current, 'What is driving churn here?')}
              />
            </Askable>

            <Askable meta={{ widget: 'pipeline-card', stage: 'enterprise', value: '$1.8M', trend: 'flat' }} ref={pipelineRef}>
              <MetricCard
                title="Pipeline"
                value="$1.8M"
                detail="Enterprise pipeline is flat"
                onAskAI={() => openAskAI(pipelineRef.current, 'What should I investigate in pipeline?')}
              />
            </Askable>
          </div>

          <section style={{ border: '1px solid #ddd', borderRadius: 16, padding: 16, marginTop: 20, background: '#fafafa' }}>
            <h2 style={{ marginTop: 0 }}>Captured Askable context</h2>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{starterPrompt}</pre>
          </section>
        </main>

        <aside style={{ border: '1px solid #ddd', borderRadius: 16, padding: 16, background: isPanelOpen ? '#fff' : '#f8f8f8', minHeight: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Ask AI panel</h2>
            <button onClick={() => setIsPanelOpen((v) => !v)}>{isPanelOpen ? 'Close' : 'Open'}</button>
          </div>

          {!isPanelOpen ? (
            <p style={{ color: '#666' }}>Use any “Ask AI” button on a card to open the assistant with explicit UI context.</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                {messages.map((message, index) => (
                  <div key={index} style={{ borderRadius: 12, padding: 12, background: message.role === 'user' ? '#eef2ff' : '#f5f5f5' }}>
                    <strong style={{ display: 'block', marginBottom: 6 }}>{message.role === 'user' ? 'User' : 'Assistant'}</strong>
                    <div>{message.content}</div>
                  </div>
                ))}
              </div>

              <section style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Where CopilotKit / AI SDK fits</h3>
                <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                  <li>Use Askable to capture the focused card or UI region</li>
                  <li>Send <code>promptContext</code> alongside the user’s question</li>
                  <li>Render assistant replies in this panel</li>
                </ul>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  onAskAI,
}: {
  title: string;
  value: string;
  detail: string;
  onAskAI: () => void;
}) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 16, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>{value}</p>
      <p style={{ color: '#666' }}>{detail}</p>
      <button onClick={onAskAI}>Ask AI</button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
