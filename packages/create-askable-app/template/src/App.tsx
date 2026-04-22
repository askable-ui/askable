import { useMemo, useRef, useState } from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotReadable } from '@copilotkit/react-core';
import { useAskable } from '@askable-ui/react';

type MetricCard = {
  id: string;
  label: string;
  value: string;
  delta: string;
  narrative: string;
  detail: string;
};

type Deal = {
  id: string;
  company: string;
  stage: string;
  value: string;
  owner: string;
};

const metrics: MetricCard[] = [
  {
    id: 'pipeline-coverage',
    label: 'Pipeline coverage',
    value: '3.9x',
    delta: '+0.4x week over week',
    narrative: 'Coverage exceeds the 3.5x target after enterprise expansion in financial services.',
    detail: 'AI focus summary: pipeline coverage is 3.9x against a 3.5x target, driven by enterprise pipeline growth.',
  },
  {
    id: 'net-revenue-retention',
    label: 'Net revenue retention',
    value: '118%',
    delta: '+6 pts quarter over quarter',
    narrative: 'Existing accounts expanded after onboarding automation shipped to the top five teams.',
    detail: 'AI focus summary: NRR is 118%, up 6 points quarter over quarter due to expansion in installed accounts.',
  },
  {
    id: 'support-backlog',
    label: 'Support backlog',
    value: '24 tickets',
    delta: '-31% since last Friday',
    narrative: 'Backlog is falling after the self-serve billing flow and routing updates reduced triage load.',
    detail: 'AI focus summary: support backlog fell to 24 tickets, down 31%, after self-serve billing and routing improvements.',
  },
];

const deals: Deal[] = [
  { id: 'acme', company: 'Acme Foods', stage: 'Security review', value: '$84k', owner: 'Nina' },
  { id: 'northstar', company: 'Northstar Health', stage: 'Champion identified', value: '$122k', owner: 'Sam' },
  { id: 'lattice', company: 'Lattice Cloud', stage: 'Commercials', value: '$61k', owner: 'Aria' },
  { id: 'meridian', company: 'Meridian Retail', stage: 'Pilot live', value: '$48k', owner: 'Jon' },
];

function askableMeta(meta: Record<string, string>) {
  return JSON.stringify(meta);
}

export default function App() {
  const { ctx, promptContext } = useAskable();
  const [selectedPanel, setSelectedPanel] = useState<string | null>(null);
  const panelRefs = useRef<Record<string, HTMLElement | null>>({});

  const currentContext = promptContext || 'No panel selected yet. Hover or click a KPI card or deal row to feed Askable context into CopilotKit.';
  const recentContext = useMemo(() => {
    const history = ctx.toHistoryContext(4);
    return history || 'Recent UI history will appear here after a few interactions.';
  }, [ctx, promptContext]);

  useCopilotReadable(
    {
      description: 'The Askable UI panel the user is currently focused on.',
      value: currentContext,
    },
    [currentContext],
  );

  useCopilotReadable(
    {
      description: 'Recent Askable UI focus history from newest to oldest.',
      value: recentContext,
    },
    [recentContext],
  );

  function focusPanel(id: string) {
    const panel = panelRefs.current[id];
    if (!panel) return;
    ctx.select(panel);
    setSelectedPanel(id);
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <section className="hero card">
          <div>
            <p className="eyebrow">askable-ui + CopilotKit starter</p>
            <h1>Ship a UI-aware copilot in one scaffold.</h1>
            <p className="hero-copy">
              Hover or click any panel to update Askable context. CopilotKit receives the current focus and recent history via
              <code> useCopilotReadable() </code>
              so the assistant can answer about exactly what the user sees.
            </p>
          </div>
          <div className="hero-actions">
            <button type="button" onClick={() => focusPanel('pipeline-coverage')}>
              Ask about pipeline
            </button>
            <button type="button" className="secondary" onClick={() => focusPanel('northstar')}>
              Ask about Northstar
            </button>
          </div>
        </section>

        <section className="metrics-grid">
          {metrics.map((metric) => (
            <article
              key={metric.id}
              ref={(node) => {
                panelRefs.current[metric.id] = node;
              }}
              className={`card metric-card ${selectedPanel === metric.id ? 'is-selected' : ''}`}
              data-askable={askableMeta({
                area: 'executive dashboard',
                panel: metric.label,
                value: metric.value,
                delta: metric.delta,
              })}
              data-askable-text={metric.detail}
            >
              <div className="metric-head">
                <span>{metric.label}</span>
                <span className="delta">{metric.delta}</span>
              </div>
              <strong>{metric.value}</strong>
              <p>{metric.narrative}</p>
              <button type="button" className="link-button" onClick={() => focusPanel(metric.id)}>
                Ask AI about this card
              </button>
            </article>
          ))}
        </section>

        <section className="grid-two">
          <article
            className={`card chart-card ${selectedPanel === 'forecast' ? 'is-selected' : ''}`}
            ref={(node) => {
              panelRefs.current.forecast = node;
            }}
            data-askable={askableMeta({
              area: 'forecast',
              chart: 'quarterly revenue',
              trend: 'up and to the right',
              confidence: 'medium-high',
            })}
            data-askable-text="AI focus summary: quarterly revenue is rising steadily from $1.2M in Q1 to a projected $1.9M in Q4, with strongest momentum in enterprise expansions."
          >
            <div className="section-head">
              <div>
                <p className="eyebrow">Forecast</p>
                <h2>Quarterly revenue outlook</h2>
              </div>
              <button type="button" className="link-button" onClick={() => focusPanel('forecast')}>
                Ask AI about this chart
              </button>
            </div>
            <div className="bars" aria-hidden="true">
              <span style={{ height: '46%' }} />
              <span style={{ height: '59%' }} />
              <span style={{ height: '74%' }} />
              <span style={{ height: '92%' }} />
            </div>
            <p className="chart-caption">Q4 upside comes from larger multi-product expansions rather than raw logo growth.</p>
          </article>

          <article className="card context-card">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Live Askable context</p>
                <h2>What CopilotKit can currently read</h2>
              </div>
            </div>
            <pre>{currentContext}</pre>
            <h3>Recent focus history</h3>
            <pre>{recentContext}</pre>
          </article>
        </section>

        <section className="card deals-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Pipeline drilldown</p>
              <h2>Priority deals</h2>
            </div>
          </div>
          <div className="table-head">
            <span>Account</span>
            <span>Stage</span>
            <span>Value</span>
            <span>Owner</span>
          </div>
          <div className="deal-list">
            {deals.map((deal) => (
              <button
                key={deal.id}
                type="button"
                ref={(node) => {
                  panelRefs.current[deal.id] = node;
                }}
                className={`deal-row ${selectedPanel === deal.id ? 'is-selected' : ''}`}
                data-askable={askableMeta({
                  area: 'pipeline drilldown',
                  account: deal.company,
                  stage: deal.stage,
                  value: deal.value,
                  owner: deal.owner,
                })}
                data-askable-text={`AI focus summary: ${deal.company} is in ${deal.stage}, worth ${deal.value}, owned by ${deal.owner}.`}
                onClick={() => focusPanel(deal.id)}
              >
                <span>{deal.company}</span>
                <span>{deal.stage}</span>
                <span>{deal.value}</span>
                <span>{deal.owner}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <aside className="copilot-panel">
        <div className="copilot-panel-header">
          <p className="eyebrow">CopilotKit sidebar</p>
          <h2>Ask about whatever is selected</h2>
          <p>
            Add <code>OPENAI_API_KEY</code> to <code>.env</code> to enable responses from the local runtime.
          </p>
        </div>
        <CopilotSidebar
          instructions="You are a helpful revenue operations copilot. Use the Askable context and recent focus history to answer precisely about the currently selected panel. If no panel is selected, ask the user what they want to inspect."
          defaultOpen
          clickOutsideToClose={false}
          labels={{
            title: 'Askable Copilot',
            initial: 'Ask about the highlighted KPI, chart, or deal.',
          }}
        />
      </aside>
    </div>
  );
}
