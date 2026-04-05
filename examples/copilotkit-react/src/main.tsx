import React from 'react';
import ReactDOM from 'react-dom/client';
import { Askable, useAskable } from '@askable-ui/react';

function App() {
  const { promptContext, ctx } = useAskable({ events: ['click'] });

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Askable example scaffold</h1>
      <p>This example will become the first-class CopilotKit / AI app integration demo.</p>

      <Askable meta={{ widget: 'revenue-card', period: 'Q3', value: '$2.3M' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h2>Revenue</h2>
          <p>$2.3M</p>
          <button onClick={(e) => {
            const target = (e.currentTarget as HTMLButtonElement).closest('[data-askable]') as HTMLElement | null;
            if (target) ctx.select(target);
          }}>
            Ask AI about this card
          </button>
        </div>
      </Askable>

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fafafa' }}>
        <h2>Prompt context</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{promptContext}</pre>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
