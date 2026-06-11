import { For, Show } from 'solid-js';
import {
  Askable,
  useAskable,
  useAskableViewport,
  useAskableHistory,
  useAskableCompose,
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
  shell: 'display:grid;grid-template-columns:1fr 320px;height:100vh;overflow:hidden;font-family:system-ui,sans-serif;background:#0f0f12;color:#e2e8f0',
  main: 'overflow-y:auto;padding:24px 28px',
  h1: 'font-size:20px;font-weight:700;margin:0 0 20px',
  grid: 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px',
  card: 'background:#1e293b;border:1px solid #334155;border-radius:10px;padding:18px 20px;cursor:pointer;transition:border-color 0.15s',
  cardLabel: 'font-size:12px;color:#94a3b8;font-weight:500;display:block;margin-bottom:6px',
  cardValue: 'font-size:26px;font-weight:700;letter-spacing:-0.5px;display:block',
  cardDelta: 'font-size:13px;margin-top:4px',
  table: 'background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden',
  tableTitle: 'font-size:14px;font-weight:600;padding:14px 18px;border-bottom:1px solid #334155;margin:0',
  tr: 'border-bottom:1px solid #1e293b;cursor:pointer;transition:background 0.1s',
  th: 'text-align:left;font-size:12px;color:#94a3b8;font-weight:500;padding:10px 16px',
  td: 'padding:12px 16px;font-size:14px',
  sidebar: 'border-left:1px solid #1e293b;background:#13131a;display:flex;flex-direction:column;overflow:hidden',
  sidebarHeader: 'padding:14px 16px;border-bottom:1px solid #1e293b;font-size:13px;font-weight:600',
  tab: 'display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #1e293b',
  tabBtn: 'font-size:11px;padding:3px 10px;border-radius:99px;border:none;cursor:pointer;font-weight:600',
  panel: 'flex:1;overflow-y:auto;padding:14px 12px;font-size:12px;line-height:1.6',
  code: 'display:block;background:#0f172a;border-radius:6px;padding:10px;white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:11px;color:#94a3b8',
  histItem: 'padding:6px 0;border-bottom:1px solid #1e293b;display:flex;gap:6px;align-items:flex-start',
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
  // Pass a reactive accessor so SolidJS tracks signal reads inside createMemo
  const { promptContext: composedCtx } = useAskableCompose(() => ({
    sections: [
      { label: 'Focused element', value: focusCtx() },
      { label: 'Visible elements', value: viewportCtx() },
      { label: 'Navigation trail', value: historyCtx() },
    ],
  }));

  return (
    <div style={S.shell}>
      {/* ── dashboard ── */}
      <main style={S.main}>
        <h1 style={S.h1}>Sales Dashboard</h1>

        {/* KPI cards */}
        <div style={S.grid}>
          <For each={KPIS}>
            {(kpi) => (
              <Askable meta={kpi}>
                <article style={S.card}>
                  <span style={S.cardLabel}>{kpi.label}</span>
                  <span style={S.cardValue}>{kpi.value}</span>
                  <span
                    style={`${S.cardDelta};color:${kpi.trend === 'down' ? '#4ade80' : kpi.trend === 'up' ? '#4ade80' : '#94a3b8'}`}
                  >
                    {kpi.delta}
                  </span>
                </article>
              </Askable>
            )}
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
                  <tr
                    style={S.tr}
                    data-askable={JSON.stringify(deal)}
                  >
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

      {/* ── context sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <span>AI Context Inspector</span>
          <span style="font-weight:400;color:#64748b;margin-left:8px;font-size:11px">
            {visibleItems().length} visible
          </span>
        </div>

        <div style={S.panel}>
          {/* current focus */}
          <p style="color:#94a3b8;margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">
            FOCUSED
          </p>
          <Show
            when={focus()}
            fallback={<p style="color:#475569;font-style:italic">Click any card or row…</p>}
          >
            {(f) => {
              const typed = asMeta<KpiMeta | DealMeta>(f());
              return (
                <code style={S.code}>{JSON.stringify(typed.meta, null, 2)}</code>
              );
            }}
          </Show>

          {/* composed context */}
          <p style="color:#94a3b8;margin:16px 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">
            COMPOSED PROMPT CONTEXT
          </p>
          <code style={S.code}>{composedCtx()}</code>

          {/* history */}
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
                      ? ((item.meta as Record<string, unknown>).label ?? (item.meta as Record<string, unknown>).company ?? JSON.stringify(item.meta))
                      : item.meta}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </aside>
    </div>
  );
}
