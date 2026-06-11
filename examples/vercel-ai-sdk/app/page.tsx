'use client';

import { useChat } from 'ai/react';
import { Askable, useAskable } from '@askable-ui/react';
import { useRef } from 'react';

// --- sample data -----------------------------------------------------------

const KPI_CARDS = [
  { id: 'revenue', label: 'Revenue', value: '$2.34M', delta: '+12%', period: 'Q2 2025', trend: 'up' },
  { id: 'arr', label: 'ARR', value: '$9.1M', delta: '+8%', period: 'Q2 2025', trend: 'up' },
  { id: 'churn', label: 'Churn Rate', value: '2.1%', delta: '-0.4%', period: 'Q2 2025', trend: 'down-good' },
  { id: 'nps', label: 'NPS Score', value: '72', delta: '+5', period: 'Q2 2025', trend: 'up' },
];

const DEALS = [
  { id: 'd1', company: 'Acme Corp', stage: 'Negotiation', value: '$120,000', rep: 'Sarah K.' },
  { id: 'd2', company: 'Globex', stage: 'Proposal', value: '$85,000', rep: 'Tom R.' },
  { id: 'd3', company: 'Initech', stage: 'Discovery', value: '$45,000', rep: 'Maria L.' },
  { id: 'd4', company: 'Umbrella Ltd', stage: 'Closed Won', value: '$210,000', rep: 'James P.' },
  { id: 'd5', company: 'Hooli Inc', stage: 'Closed Lost', value: '$60,000', rep: 'Sarah K.' },
];

// --- main component --------------------------------------------------------

export default function Dashboard() {
  const { focus, promptContext } = useAskable();
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    // send the current UI context with every request
    body: { uiContext: promptContext },
  });

  return (
    <div style={styles.shell}>
      {/* ── left: dashboard ─────────────────────────── */}
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sales Dashboard</h1>
          <span style={styles.badge}>
            {focus ? `Focused: ${typeof focus.meta === 'object' ? (focus.meta as Record<string,unknown>).id ?? focus.meta : focus.meta}` : 'Click any card or row'}
          </span>
        </header>

        {/* KPI cards */}
        <section style={styles.kpiGrid}>
          {KPI_CARDS.map((kpi) => (
            <Askable
              key={kpi.id}
              meta={{ id: kpi.id, label: kpi.label, value: kpi.value, delta: kpi.delta, period: kpi.period }}
            >
              <article style={styles.kpiCard}>
                <span style={styles.kpiLabel}>{kpi.label}</span>
                <span style={styles.kpiValue}>{kpi.value}</span>
                <span style={{ color: kpi.trend === 'down-good' || kpi.trend === 'up' ? '#4ade80' : '#f87171', fontSize: 13 }}>
                  {kpi.delta} vs last quarter
                </span>
              </article>
            </Askable>
          ))}
        </section>

        {/* Deals table */}
        <section style={styles.tableSection}>
          <h2 style={styles.sectionTitle}>Open Deals</h2>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Company</th>
                <th style={styles.th}>Stage</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Rep</th>
              </tr>
            </thead>
            <tbody>
              {DEALS.map((deal) => (
                <tr
                  key={deal.id}
                  style={styles.tr}
                  data-askable={JSON.stringify({ id: deal.id, company: deal.company, stage: deal.stage, value: deal.value, rep: deal.rep })}
                >
                  <td style={styles.td}>{deal.company}</td>
                  <td style={styles.td}><StageBadge stage={deal.stage} /></td>
                  <td style={styles.td}>{deal.value}</td>
                  <td style={styles.td}>{deal.rep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {/* ── right: AI chat ───────────────────────────── */}
      <aside style={styles.chatPanel}>
        <div style={styles.chatHeader}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>AI Assistant</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>context-aware</span>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.hint}>
              Click any metric card or deal row, then ask me about it — I already know what you&apos;re looking at.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
              <span style={styles.msgLabel}>{m.role === 'user' ? 'You' : 'AI'}</span>
              <p style={{ margin: 0 }}>{m.content}</p>
            </div>
          ))}
          {isLoading && <span style={{ opacity: 0.4, fontSize: 13 }}>thinking…</span>}
        </div>

        <form onSubmit={handleSubmit} style={styles.chatForm}>
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about what you're looking at…"
            style={styles.chatInput}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} style={styles.sendBtn}>
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const color: Record<string, string> = {
    'Closed Won': '#4ade80',
    'Closed Lost': '#f87171',
    Negotiation: '#facc15',
    Proposal: '#60a5fa',
    Discovery: '#a78bfa',
  };
  return (
    <span style={{ background: color[stage] ?? '#94a3b8', color: '#0f0f12', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
      {stage}
    </span>
  );
}

// --- styles ----------------------------------------------------------------

const styles = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden' } as React.CSSProperties,
  main: { flex: 1, overflowY: 'auto', padding: '24px 28px' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 } as React.CSSProperties,
  badge: { fontSize: 12, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '3px 10px', color: '#94a3b8' } as React.CSSProperties,
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 } as React.CSSProperties,
  kpiCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '18px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, transition: 'border-color 0.15s' } as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: '#94a3b8', fontWeight: 500 } as React.CSSProperties,
  kpiValue: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' } as React.CSSProperties,
  tableSection: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  sectionTitle: { margin: 0, padding: '16px 20px', fontSize: 14, fontWeight: 600, borderBottom: '1px solid #334155' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' } as React.CSSProperties,
  thead: { background: '#0f172a' } as React.CSSProperties,
  th: { padding: '10px 16px', textAlign: 'left', fontSize: 12, color: '#94a3b8', fontWeight: 500 } as React.CSSProperties,
  tr: { borderBottom: '1px solid #1e293b', cursor: 'pointer', transition: 'background 0.1s' } as React.CSSProperties,
  td: { padding: '12px 16px', fontSize: 14 } as React.CSSProperties,
  chatPanel: { width: 340, borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', background: '#13131a' } as React.CSSProperties,
  chatHeader: { padding: '16px 18px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
  messages: { flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties,
  hint: { fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: 0 } as React.CSSProperties,
  userMsg: { background: '#1e293b', borderRadius: '10px 10px 4px 10px', padding: '10px 12px', marginLeft: 20 } as React.CSSProperties,
  aiMsg: { background: '#0f172a', borderRadius: '10px 10px 10px 4px', padding: '10px 12px', marginRight: 20 } as React.CSSProperties,
  msgLabel: { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 } as React.CSSProperties,
  chatForm: { padding: '12px 14px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8 } as React.CSSProperties,
  chatInput: { flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' } as React.CSSProperties,
  sendBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 } as React.CSSProperties,
} as const;
