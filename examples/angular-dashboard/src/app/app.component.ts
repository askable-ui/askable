import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgFor, NgIf, JsonPipe } from '@angular/common';
import {
  AskableService,
  AskableDirective,
  AskableHistoryService,
  AskableViewportService,
  useAskableCompose,
  asMeta,
} from '@askable-ui/angular';

interface KpiMeta { metric: string; value: string; delta: string; trend: string }
interface DealMeta { company: string; stage: string; value: string }

const KPIS = [
  { metric: 'Revenue', value: '$2.4M', delta: '+12%', trend: 'up' },
  { metric: 'Active Users', value: '18,400', delta: '+8%', trend: 'up' },
  { metric: 'Churn Rate', value: '2.1%', delta: '-0.3%', trend: 'down' },
  { metric: 'NPS Score', value: '72', delta: '+4', trend: 'up' },
];

const DEALS = [
  { company: 'Acme Corp', stage: 'Negotiation', value: '$120K' },
  { company: 'GlobalTech', stage: 'Proposal', value: '$85K' },
  { company: 'Finova', stage: 'Discovery', value: '$200K' },
  { company: 'Buildfast', stage: 'Closed Won', value: '$60K' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgFor, NgIf, JsonPipe, AskableDirective],
  providers: [AskableHistoryService, AskableViewportService],
  template: `
    <div class="layout">
      <main class="dashboard">
        <h1>Analytics Dashboard</h1>

        <section class="kpi-grid">
          <article
            *ngFor="let kpi of kpis"
            class="kpi-card"
            [askable]="kpi"
            askableScope="kpis"
          >
            <span class="kpi-metric">{{ kpi.metric }}</span>
            <span class="kpi-value">{{ kpi.value }}</span>
            <span class="kpi-delta" [class.up]="kpi.trend === 'up'">{{ kpi.delta }}</span>
          </article>
        </section>

        <section class="deals">
          <h2>Pipeline</h2>
          <table>
            <thead>
              <tr><th>Company</th><th>Stage</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let deal of deals"
                [askable]="deal"
                askableScope="pipeline"
              >
                <td>{{ deal.company }}</td>
                <td><span class="stage-badge">{{ deal.stage }}</span></td>
                <td>{{ deal.value }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <aside class="context-panel">
        <h2>AI Context</h2>

        <div class="context-block">
          <h3>Focused element</h3>
          <pre>{{ askable.focus() | json }}</pre>
        </div>

        <div class="context-block">
          <h3>Navigation history</h3>
          <pre>{{ history.promptContext() }}</pre>
        </div>

        <div class="context-block">
          <h3>Combined prompt</h3>
          <pre>{{ promptContext() }}</pre>
        </div>

        <div class="context-block">
          <h3>Typed meta (KPI)</h3>
          <pre *ngIf="typedFocus()">metric={{ typedFocus()!.metric }}&#10;value={{ typedFocus()!.value }}</pre>
          <pre *ngIf="!typedFocus()">Click a KPI card</pre>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .layout { display: flex; gap: 2rem; padding: 2rem; font-family: system-ui, sans-serif; }
    .dashboard { flex: 1; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .kpi-card { padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 12px; cursor: pointer;
                transition: border-color 0.2s; }
    .kpi-card:hover { border-color: #6366f1; }
    .kpi-metric { display: block; font-size: 0.875rem; color: #6b7280; }
    .kpi-value { display: block; font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0; }
    .kpi-delta { font-size: 0.875rem; color: #6b7280; }
    .kpi-delta.up { color: #10b981; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    tr:hover td { background: #f9fafb; cursor: pointer; }
    .stage-badge { padding: 0.25rem 0.5rem; border-radius: 9999px; background: #ede9fe; color: #7c3aed; font-size: 0.75rem; }
    .context-panel { width: 360px; flex-shrink: 0; }
    .context-block { margin-bottom: 1.5rem; }
    h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
    h3 { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; margin-bottom: 0.5rem; }
    pre { background: #f3f4f6; border-radius: 8px; padding: 0.75rem; font-size: 0.75rem;
          white-space: pre-wrap; overflow: auto; max-height: 120px; }
  `],
})
export class AppComponent implements OnInit {
  readonly askable = inject(AskableService);
  readonly history = inject(AskableHistoryService);
  readonly viewport = inject(AskableViewportService);

  readonly kpis = KPIS;
  readonly deals = DEALS;

  readonly sections = computed(() => [
    { label: 'Focused element', value: this.askable.promptContext() },
    { label: 'Navigation history', value: this.history.promptContext() },
    { label: 'Visible elements', value: this.viewport.promptContext() },
  ]);

  readonly { promptContext } = useAskableCompose(this.sections);

  readonly typedFocus = computed(() => {
    const f = this.askable.focus();
    if (!f || typeof f.meta !== 'object' || !('metric' in f.meta)) return null;
    return asMeta<KpiMeta>(f).meta;
  });

  ngOnInit(): void {
    this.history.init(this.askable.context);
    this.viewport.observe({ scope: 'kpis' });
  }
}
