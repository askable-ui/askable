import type { AskableFocus } from '@askable-ui/core';
import { Askable } from '@askable-ui/react';

// ── Data ────────────────────────────────────────────────────────────────────

interface Metric {
  id: string;
  title: string;
  value: string;
  change: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  detail: string;
  meta: Record<string, unknown>;
}

const METRICS: Metric[] = [
  {
    id: 'revenue',
    title: 'Revenue',
    value: '$2.3M',
    change: '-12%',
    sentiment: 'negative',
    detail: 'Down vs last quarter',
    meta: {
      widget: 'revenue',
      period: 'Q3 2024',
      value: '$2.3M',
      change: '-12% QoQ',
      trend: 'declining since Q1',
    },
  },
  {
    id: 'churn',
    title: 'Churn Rate',
    value: '4.2%',
    change: '+0.8pp',
    sentiment: 'negative',
    detail: 'Up 0.8 percentage points',
    meta: {
      widget: 'churn',
      segment: 'SMB',
      period: 'Q3 2024',
      value: '4.2%',
      change: '+0.8pp QoQ',
      benchmark: '3.0% industry avg',
    },
  },
  {
    id: 'mrr',
    title: 'MRR',
    value: '$890K',
    change: '+8%',
    sentiment: 'positive',
    detail: 'Steady growth',
    meta: {
      widget: 'mrr',
      period: 'Q3 2024',
      value: '$890K',
      change: '+8% QoQ',
      trend: 'growing 3 consecutive quarters',
    },
  },
  {
    id: 'nps',
    title: 'NPS Score',
    value: '72',
    change: '+5pts',
    sentiment: 'positive',
    detail: 'Above industry benchmark',
    meta: {
      widget: 'nps',
      period: 'Q3 2024',
      value: '72',
      change: '+5 points QoQ',
      benchmark: '55 industry avg',
    },
  },
];

interface Deal {
  company: string;
  value: string;
  stage: string;
  stageClass: string;
  probability: string;
  rep: string;
}

const DEALS: Deal[] = [
  { company: 'Acme Corp', value: '$180K', stage: 'Negotiation', stageClass: 'negotiation', probability: '75%', rep: 'Sarah Chen' },
  { company: 'Globex Inc', value: '$95K', stage: 'Proposal', stageClass: 'proposal', probability: '45%', rep: 'Mike Torres' },
  { company: 'Initech', value: '$250K', stage: 'Closed Won', stageClass: 'closed-won', probability: '100%', rep: 'Sarah Chen' },
  { company: 'Umbrella Ltd', value: '$120K', stage: 'Discovery', stageClass: 'discovery', probability: '20%', rep: 'Alex Kim' },
  { company: 'Stark Industries', value: '$340K', stage: 'Proposal', stageClass: 'proposal', probability: '60%', rep: 'Mike Torres' },
];

// ── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard({ focus }: { focus: AskableFocus | null }) {
  const focusedWidget =
    focus && typeof focus.meta === 'object'
      ? (focus.meta as Record<string, unknown>).widget
      : null;

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1 className="header__title">Sales Dashboard</h1>
          <p className="header__subtitle">Q3 2024 Performance</p>
        </div>
        {focus && (
          <span className="context-badge">
            Selected: <strong>{String(focusedWidget ?? 'element')}</strong>
          </span>
        )}
      </header>

      {/* Metric cards */}
      <section className="metrics-grid">
        {METRICS.map((m) => (
          <Askable key={m.id} meta={m.meta} id={`metric-${m.id}`}>
            <div
              className={`metric-card ${focusedWidget === m.id ? 'metric-card--focused' : ''}`}
            >
              <div className="metric-card__header">
                <span className="metric-card__title">{m.title}</span>
                <span
                  className={`metric-card__badge metric-card__badge--${m.sentiment}`}
                >
                  {m.change}
                </span>
              </div>
              <div className="metric-card__value">{m.value}</div>
              <div className="metric-card__detail">{m.detail}</div>
            </div>
          </Askable>
        ))}
      </section>

      {/* Deals table */}
      <section>
        <Askable
          id="deals-table"
          meta={{
            widget: 'deals-table',
            description: 'Pipeline deals for Q3 2024',
            totalValue: '$985K across 5 deals',
            topRep: 'Sarah Chen ($430K)',
            stages: 'Discovery, Proposal, Negotiation, Closed Won',
          }}
        >
          <div
            className={`table-card ${focusedWidget === 'deals-table' ? 'table-card--focused' : ''}`}
          >
            <h2 className="table-card__title">Pipeline Deals</h2>
            <table className="deals-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Value</th>
                  <th>Stage</th>
                  <th>Probability</th>
                  <th>Rep</th>
                </tr>
              </thead>
              <tbody>
                {DEALS.map((d) => (
                  <tr key={d.company}>
                    <td className="deals-table__company">{d.company}</td>
                    <td className="mono">{d.value}</td>
                    <td>
                      <span className={`stage stage--${d.stageClass}`}>
                        {d.stage}
                      </span>
                    </td>
                    <td className="mono">{d.probability}</td>
                    <td>{d.rep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Askable>
      </section>

      {/* The Askable context is passed to the AI via useCopilotReadable in CopilotBridge.
          The sidebar header (SidebarHeader) shows the selected element visually. */}
    </div>
  );
}
