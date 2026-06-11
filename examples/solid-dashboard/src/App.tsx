import { createSignal, For, Show } from 'solid-js';
import {
  Askable,
  useAskable,
  useAskableViewport,
  useAskableHistory,
  useAskableCompose,
  useAskableChat,
  asMeta,
} from '@askable-ui/solid';

// ── sample data ──────────────────────────────────────────────────────────────

interface KpiMeta {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'neutral';
}

interface DealMeta {
  id: string;
  company: string;
  stage: string;
  value: string;
  rep: string;
}

const KPIS: KpiMeta[] = [
  { id: 'revenue', label: 'Revenue', value: '$2.34M', delta: '+12%', trend: 'up' },
  { id: 'arr', label: 'ARR', value: '$9.1M', delta: '+8%', trend: 'up' },
  { id: 'churn', label: 'Churn Rate', value: '2.1%', delta: '-0.4%', trend: 'down' },
  { id: 'nps', label: 'NPS', value: '72', delta: '+5', trend: 'up' },
];

const DEALS: DealMeta[] = [
  { id: 'd1', company: 'Acme Corp', stage: 'Negotiation', value: '$120,000', rep: 'Sarah K.' },
  { id: 'd2', company: 'Globex', stage: 'Proposal', value: '$85,000', rep: 'Tom R.' },
  { id: 'd3', company: 'Initech', stage: 'Discovery', value: '$45,000', rep: 'Maria L.' },
  { id: 'd4', company: 'Umbrella', stage: 'Closed Won', value: '$210,000', rep: 'James P.' },
  { id: 'd5', company: 'Hooli', stage: 'Closed Lost', value: '$60,000', rep: 'Sarah K.' },
];

// ── styles ───────────────────────────────────────────────────────────────────

const S = {
  shell: 'display:grid;grid-template-columns:1fr 360px;height:100vh;overflow:hidden;font-family:system-ui,sans-serif;background:#0f0f12;color:#e2e8f0',
  main: 'overflow-y:auto;padding:24px 28px',
  h1: 'font-size:20px;font-weight:700;margin:0 0 20px',
  grid: 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px',
  card: 'background:#1e293b;border:1px solid #334155;border-radius:10px;padding:18px 20px;cursor:pointer;transition:border-color 0.15s',
  cardActive: 'background:#1e293b;border:1px solid #6366f1;border-radius:10px;padding:18px 20px;cursor:pointer;transition:border-color 0.15s',
  cardLabel: 'font-size:12px;color:#94a3b8;font-weight:500;display:block;margin-bottom:6px',
  cardValue: 'font-size:26px;font-weight:700;letter-spacing:-0.5px;display:block',
  cardDelta: 'font-size:13px;margin-top:4px',
  table: 'background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden',
  tableTitle: 'font-size:14px;font-weight:600;padding:14px 18px;border-bottom:1px solid #334155;margin:0',
  tr: 'border-bottom:1px solid #1e293b;cursor:pointer;transition:background 0.1s',
  th: 'text-align:left;font-size:12px;color:#94a3b8;font-weight:500;padding:10px 16px',
  td: 'padding:12px 16px;font-size:14px',
  sidebar: 'border-left:1px solid #1e293b;background:#13131a;display:flex;flex-direction:column;overflow:hidden',
  sidebarHeader: 'padding:14px 16px;border-bottom:1px solid #1e293b;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center',
  tabs: 'display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid #1e293b;background:#0f0f12',
  tabBtn: 'font-size:11px;padding:4px 12px;border-radius:99px;border:none;cursor:pointer;font-weight:600;transition:background 0.15s',
  panel: 'flex:1;overflow-y:auto;padding:14px 12px;font-size:12px;line-height:1.6',
  code: 'display:block;background:#0f172a;border-radius:6px;padding:10px;white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:11px;color:#94a3b8',
  histItem: 'padding:6px 0;border-bottom:1px solid #1e293b;display:flex;gap:6px;align-items:flex-start',
  chatArea: 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px',
  chatBubbleUser: 'background:#6366f1;color:#fff;align-self:flex-end;padding:8px 12px;border-radius:10px;max-width:85%;font-size:13px;line-height:1.5',
  chatBubbleAI: 'background:#1e293b;color:#e2e8f0;align-self:flex-start;padding:8px 12px;border-radius:10px;max-width:90%;font-size:13px;line-height:1.5',
  chatInput: 'display:flex;gap:6px;padding:10px;border-top:1px solid #1e293b',
  input: 'flex:1;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:6px 10px;font-size:13px;outline:none',
  sendBtn: 'background:#6366f1;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;font-weight:500',
};

function stageColor(stage: string) {
  const map: Record<string, string> = {
    'Closed Won': '#4ade80',
    'Closed Lost': '#f87171',
    Negotiation: '#facc15',
    Proposal: '#60a5fa',
    Discovery: '#a78bfa',
  };
  return map[stage] ?? '#94a3b8';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function App() {
  const { focus, promptContext: focusCtx } = useAskable();
  const { visibleItems, promptContext: viewportCtx } = useAskableViewport({ threshold: 0.3 });
  const { history, promptContext: historyCtx } = useAskableHistory({ maxEntries: 8 });
  const { promptContext: composedCtx } = useAskableCompose(() => ({
    sections: [
      { label: 'Focused element', value: focusCtx() },
      { label: 'Visible elements', value: viewportCtx() },
      { label: 'Navigation trail', value: historyCtx() },
    ],
  }));

  const { messages, append, isStreaming, clearMessages } = useAskableChat({
    systemPrompt: (ctx) =>
      `You are a helpful analytics assistant embedded in a sales dashboard.\n\n${ctx}`,
  });

  const [tab, setTab] = createSignal<'context' | 'chat'>('chat');
  const [input, setInput] = createSignal('');

  async function handleSend(e: Event) {
    e.preventDefault();
    const question = input().trim();
    if (!question || isStreaming()) return;
    setInput('');

    await append(question, async (req, msgs, emit) => {
      const res = await fetch('/api/chat', {
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
    <div style={S.shell}>
      {/* ── dashboard ── */}
      <main style={S.main}>
        <h1 style={S.h1}>Sales Dashboard</h1>

        {/* KPI cards */}
        <div style={S.grid}>
          <For each={KPIS}>
            {(kpi) => {
              const isActive = () =>
                focus() && typeof focus()!.meta === 'object' &&
                (focus()!.meta as Record<string, unknown>).id === kpi.id;
              return (
                <Askable meta={kpi}>
                  <article style={isActive() ? S.cardActive : S.card}>
                    <span style={S.cardLabel}>{kpi.label}</span>
                    <span style={S.cardValue}>{kpi.value}</span>
                    <span
                      style={`${S.cardDelta};color:${kpi.trend === 'up' ? '#4ade80' : '#f87171'}`}
                    >
                      {kpi.delta}
                    </span>
                  </article>
                </Askable>
              );
            }}
          </For>
        </div>

        {/* Deals table */}
        <section style={S.table}>
          <h2 style={S.tableTitle}>Open Deals</h2>
          <table style="width:100%;border-collapse:collapse">
            <thead style="background:#0f172a">
              <tr>
                <th style={S.th}>Company</th>
                <th style={S.th}>Stage</th>
                <th style={S.th}>Value</th>
                <th style={S.th}>Rep</th>
              </tr>
            </thead>
            <tbody>
              <For each={DEALS}>
                {(deal) => (
                  <tr style={S.tr} data-askable={JSON.stringify(deal)}>
                    <td style={S.td}>{deal.company}</td>
                    <td style={S.td}>
                      <span
                        style={`background:${stageColor(deal.stage)};color:#0f0f12;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600`}
                      >
                        {deal.stage}
                      </span>
                    </td>
                    <td style={S.td}>{deal.value}</td>
                    <td style={S.td}>{deal.rep}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>
      </main>

      {/* ── sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <span>AI Assistant</span>
          <span style="font-weight:400;color:#64748b;font-size:11px">
            {visibleItems().length} visible items
          </span>
        </div>

        {/* tabs */}
        <div style={S.tabs}>
          {(['chat', 'context'] as const).map((t) => (
            <button
              style={`${S.tabBtn};background:${tab() === t ? '#6366f1' : '#1e293b'};color:${tab() === t ? '#fff' : '#94a3b8'}`}
              onClick={() => setTab(t)}
            >
              {t === 'chat' ? 'Chat' : 'Context'}
            </button>
          ))}
        </div>

        {/* chat panel */}
        <Show when={tab() === 'chat'}>
          <div style={S.chatArea}>
            <Show when={messages().filter((m) => m.role !== 'system').length === 0}>
              <p style="color:#475569;font-style:italic;text-align:center;margin-top:2rem;font-size:13px">
                Click a card or row, then ask a question.
              </p>
            </Show>
            <For each={messages().filter((m) => m.role !== 'system')}>
              {(m) => (
                <div style={m.role === 'user' ? S.chatBubbleUser : S.chatBubbleAI}>
                  {m.content || (isStreaming() ? '…' : '')}
                </div>
              )}
            </For>
          </div>
          <form style={S.chatInput} onSubmit={handleSend}>
            <input
              style={S.input}
              value={input()}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder="Ask about what you see…"
              disabled={isStreaming()}
            />
            <button
              type="submit"
              style={`${S.sendBtn};opacity:${isStreaming() || !input().trim() ? '0.4' : '1'}`}
              disabled={isStreaming() || !input().trim()}
            >
              {isStreaming() ? '…' : 'Send'}
            </button>
          </form>
          <Show when={messages().filter((m) => m.role !== 'system').length > 0}>
            <button
              style="background:none;border:none;color:#475569;font-size:11px;cursor:pointer;padding:4px 10px 8px;text-align:right"
              onClick={clearMessages}
            >
              Clear chat
            </button>
          </Show>
        </Show>

        {/* context inspector panel */}
        <Show when={tab() === 'context'}>
          <div style={S.panel}>
            <p style="color:#94a3b8;margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">
              FOCUSED
            </p>
            <Show
              when={focus()}
              fallback={<p style="color:#475569;font-style:italic">Click any card or row…</p>}
            >
              {(f) => {
                const typed = asMeta<KpiMeta | DealMeta>(f());
                return <code style={S.code}>{JSON.stringify(typed.meta, null, 2)}</code>;
              }}
            </Show>

            <p style="color:#94a3b8;margin:16px 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">
              COMPOSED CONTEXT
            </p>
            <code style={S.code}>{composedCtx() || '(no context)'}</code>

            <Show when={history().length > 0}>
              <p style="color:#94a3b8;margin:16px 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">
                RECENT ({history().length})
              </p>
              <For each={history()}>
                {(item, i) => (
                  <div style={S.histItem}>
                    <span style={`color:${i() === 0 ? '#60a5fa' : '#475569'};font-weight:700`}>
                      {i() === 0 ? '→' : '·'}
                    </span>
                    <span style="color:#94a3b8">
                      {typeof item.meta === 'object'
                        ? ((item.meta as Record<string, unknown>).label ??
                          (item.meta as Record<string, unknown>).company ??
                          JSON.stringify(item.meta))
                        : item.meta}
                    </span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </aside>
    </div>
  );
}
