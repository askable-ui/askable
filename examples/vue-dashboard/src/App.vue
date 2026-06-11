<script setup lang="ts">
/**
 * askable-ui Vue 3 Dashboard Example
 *
 * This example shows the core pattern:
 * 1. Wrap elements with <Askable :meta="..."> — the same data your chart renders
 * 2. useAskable() gives you promptContext — updates automatically on focus/click
 * 3. Pass promptContext to any LLM — the AI knows exactly what the user sees
 */

import { ref, computed } from 'vue';
import { Askable, useAskable } from '@askable-ui/vue';

// ── useAskable() wires the DOM listener. One call, zero config. ──────────────
const { ctx, promptContext } = useAskable();

// ── Your data ────────────────────────────────────────────────────────────────
const metrics = [
  { id: 'nrr',      label: 'Net Revenue Retention', value: '118%',      delta: '+6pp QoQ',      up: true,  meta: { metric: 'net revenue retention', value: '118%', delta: '+6pp QoQ', target: '110%', status: 'above target' } },
  { id: 'pipeline', label: 'Pipeline Coverage',      value: '3.9x',      delta: '+0.4x WoW',     up: true,  meta: { metric: 'pipeline coverage',      value: '3.9x', delta: '+0.4x WoW', target: '3.5x', totalValue: '$12.3M' } },
  { id: 'backlog',  label: 'Support Backlog',         value: '24 tickets', delta: '−31% vs Friday', up: true,  meta: { metric: 'support backlog',         value: '24 tickets', delta: '-31% since Friday', sla: '<50 tickets', p1Count: 2 } },
];

const deals = [
  { id: 'acme',      company: 'Acme Foods',       stage: 'Security review',       value: '$84k',  owner: 'Nina', meta: { company: 'Acme Foods',       stage: 'Security review',       value: '$84k',  owner: 'Nina', daysInStage: 12, riskFlag: 'procurement delay' } },
  { id: 'northstar', company: 'Northstar Health',  stage: 'Champion identified',   value: '$122k', owner: 'Sam',  meta: { company: 'Northstar Health',  stage: 'Champion identified',   value: '$122k', owner: 'Sam',  nextAction: 'exec call this week' } },
  { id: 'lattice',   company: 'Lattice Cloud',     stage: 'Commercials',           value: '$61k',  owner: 'Aria', meta: { company: 'Lattice Cloud',     stage: 'Commercials',           value: '$61k',  owner: 'Aria', discount: 'requested 15%' } },
  { id: 'meridian',  company: 'Meridian Retail',   stage: 'Pilot live',            value: '$48k',  owner: 'Jon',  meta: { company: 'Meridian Retail',   stage: 'Pilot live',            value: '$48k',  owner: 'Jon',  pilotUsers: 47 } },
];

// ── Track which element is active ────────────────────────────────────────────
const activeId = ref<string | null>(null);

function focusElement(el: HTMLElement | null, id: string) {
  if (!el) return;
  activeId.value = id;
  ctx.select(el);
}

// ── Chat ─────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'ai'; text: string }
const messages = ref<Message[]>([]);
const chatInput = ref('');
const thinking = ref(false);

const canChat = computed(() => !!promptContext.value && !thinking.value);

function mockResponse(question: string): string {
  const q = question.toLowerCase();
  const ctx_text = promptContext.value;

  // Parse the active element's meta from the context string
  if (ctx_text.includes('net revenue retention')) {
    if (q.includes('why') || q.includes('mean') || q.includes('explain') || q.includes('what'))
      return 'NRR at 118% means your existing customers are generating 18% more revenue this period than last — after accounting for churn and downgrades. The +6pp QoQ improvement shows the expansion motion is accelerating, not just holding. Target is 110%, so you\'re 8pp ahead.';
    if (q.includes('good') || q.includes('target') || q.includes('benchmark'))
      return 'Strong. Industry benchmark for top-quartile SaaS is 120%+ at scale. You\'re at 118%, 8pp above your own 110% target. The trend matters most — +6pp QoQ means this is improving, not plateauing.';
  }
  if (ctx_text.includes('pipeline coverage')) {
    if (q.includes('why') || q.includes('mean') || q.includes('explain') || q.includes('what'))
      return 'Pipeline coverage at 3.9x means you have $3.90 of pipeline for every $1 of quota. Total value is $12.3M. The +0.4x WoW increase means more deals are entering than being closed or lost. Target is 3.5x — you\'re 0.4x above it.';
    if (q.includes('risk') || q.includes('concern'))
      return 'Main risk: stage concentration. 3.9x coverage is healthy, but check whether it\'s weighted toward late stages (good) or early discovery (less reliable). Ask for a stage-weighted view before the QBR.';
  }
  if (ctx_text.includes('support backlog')) {
    if (q.includes('why') || q.includes('mean') || q.includes('explain') || q.includes('what'))
      return 'Support backlog at 24 tickets is healthy — SLA is <50. The −31% since Friday means your team is clearing tickets faster than new ones arrive, likely from the self-serve billing improvements. 2 P1 tickets in queue need same-day attention regardless.';
  }
  // Deal responses
  for (const deal of deals) {
    if (ctx_text.includes(deal.company)) {
      if (q.includes('risk') || q.includes('concern'))
        return `${deal.company} (${deal.value}): ${deal.meta.riskFlag ? `Risk flag — ${deal.meta.riskFlag}. ` : ''}${(deal.meta.daysInStage || 0) > 14 ? `${deal.meta.daysInStage} days in ${deal.stage} is longer than typical. ` : ''}${deal.meta.discount ? `Discount request: ${deal.meta.discount}. ` : ''}Owner: ${deal.owner}.`;
      return `${deal.company} is in **${deal.stage}** (${deal.value}, owned by ${deal.owner}). ${deal.meta.nextAction ? `Next action: ${deal.meta.nextAction}.` : ''}${deal.meta.pilotUsers ? ` ${deal.meta.pilotUsers} users active in pilot.` : ''}`;
    }
  }
  return `Based on the current context: ${ctx_text.slice(0, 120)}... Try asking "what does this mean?", "is this good?", or "what are the risks?"`;
}

async function sendMessage() {
  const q = chatInput.value.trim();
  if (!q || !canChat.value) return;

  chatInput.value = '';
  messages.value.push({ role: 'user', text: q });
  thinking.value = true;

  await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
  messages.value.push({ role: 'ai', text: mockResponse(q) });
  thinking.value = false;
}
</script>

<template>
  <div class="shell">
    <!-- Header -->
    <header class="header">
      <span class="logo">askable-ui <span class="badge">Vue 3 Example</span></span>
      <span class="hint">Click any card or row to update AI context</span>
    </header>

    <!-- Dashboard -->
    <main class="main">
      <!-- KPI cards -->
      <section>
        <p class="section-label">KPI metrics</p>
        <div class="kpi-grid">
          <!--
            <Askable :meta="m.meta"> keeps data-askable in sync with the component's
            reactive props. The ctx ref from useAskable() is the observer instance.
          -->
          <Askable
            v-for="m in metrics"
            :key="m.id"
            :meta="m.meta"
            :ctx="ctx"
            v-slot="{ el }"
          >
            <div
              class="kpi-card"
              :class="{ active: activeId === m.id }"
              tabindex="0"
              role="button"
              :aria-label="`${m.label} KPI card`"
              @click="focusElement(el, m.id)"
              @keydown.enter.space.prevent="focusElement(el, m.id)"
            >
              <div class="kpi-label">{{ m.label }}</div>
              <div class="kpi-value">{{ m.value }}</div>
              <div class="kpi-delta" :class="m.up ? 'up' : 'down'">
                {{ m.up ? '↑' : '↓' }} {{ m.delta }}
              </div>
            </div>
          </Askable>
        </div>
      </section>

      <!-- Deals table -->
      <section>
        <p class="section-label">Open deals</p>
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Stage</th><th>Value</th><th>Owner</th>
              </tr>
            </thead>
            <tbody>
              <Askable
                v-for="d in deals"
                :key="d.id"
                :meta="d.meta"
                :ctx="ctx"
                tag="tr"
                v-slot="{ el }"
              >
                <tr
                  class="deal-row"
                  :class="{ active: activeId === d.id }"
                  tabindex="0"
                  role="button"
                  @click="focusElement(el, d.id)"
                  @keydown.enter.space.prevent="focusElement(el, d.id)"
                >
                  <td class="company">{{ d.company }}</td>
                  <td class="stage">{{ d.stage }}</td>
                  <td class="amount">{{ d.value }}</td>
                  <td class="owner">{{ d.owner }}</td>
                </tr>
              </Askable>
            </tbody>
          </table>
        </div>
      </section>

      <!-- How it works explainer -->
      <section class="how-it-works">
        <p class="section-label" style="text-align:left;margin-bottom:.5rem">How this example works</p>
        <pre class="code-snippet">// 1. Install
npm install @askable-ui/vue

// 2. Wrap any element
&lt;Askable :meta="{ metric: 'NRR', value: '118%', delta: '+6pp' }"&gt;
  &lt;MetricCard /&gt;
&lt;/Askable&gt;

// 3. Get live context — updates on every click
const { promptContext } = useAskable();

// 4. Pass to any LLM
const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: promptContext.value },
    { role: 'user',   content: userMessage },
  ],
});</pre>
        <div class="links">
          <a href="https://github.com/askable-ui/askable" target="_blank" rel="noopener">★ GitHub</a>
          <a href="https://askable-ui.com/docs/guide/vue" target="_blank" rel="noopener">Vue docs →</a>
          <a href="https://www.npmjs.com/package/@askable-ui/vue" target="_blank" rel="noopener">npm →</a>
        </div>
      </section>
    </main>

    <!-- Sidebar -->
    <aside class="sidebar">
      <!-- Context panel -->
      <div class="context-panel">
        <div class="panel-title">
          <span class="dot" :class="{ live: !!promptContext }"></span>
          What the AI sees
        </div>
        <div class="context-box" :class="{ empty: !promptContext }">
          {{ promptContext || 'Click any card or row above...' }}
        </div>
        <button
          v-if="promptContext"
          class="copy-btn"
          @click="navigator.clipboard.writeText(promptContext)"
        >
          Copy context
        </button>
      </div>

      <!-- Chat panel -->
      <div class="chat-panel">
        <div class="messages" ref="messagesEl">
          <div v-if="messages.length === 0" class="chat-empty">
            <p>Select a metric or deal, then ask a question about it.</p>
          </div>
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="message"
            :class="m.role"
          >
            <div class="role">{{ m.role === 'user' ? 'You' : 'AI (mock)' }}</div>
            <div class="bubble">{{ m.text }}</div>
          </div>
          <div v-if="thinking" class="message ai">
            <div class="role">AI (mock)</div>
            <div class="bubble thinking">Reading context...</div>
          </div>
        </div>
        <div class="chat-input-row">
          <input
            v-model="chatInput"
            :placeholder="promptContext ? 'Ask about what you selected...' : 'Select something first...'"
            :disabled="!promptContext"
            @keydown.enter="sendMessage"
          />
          <button :disabled="!canChat" @click="sendMessage">Ask</button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 1fr 360px;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
}

.header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(7, 17, 31, 0.85);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo { font-weight: 700; font-size: 15px; }
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--accent-glow);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.hint { margin-left: auto; font-size: 12px; color: var(--text-dim); }

.main {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.section-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  font-weight: 600;
  margin-bottom: 10px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.kpi-card:hover, .kpi-card.active {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15), 0 4px 20px rgba(0,0,0,0.35);
}

.kpi-card.active { border-color: #6366f1; }

.kpi-label { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.02em; }
.kpi-value { font-size: 26px; font-weight: 700; margin-bottom: 6px; line-height: 1; }
.kpi-delta { font-size: 12px; font-weight: 500; }
.kpi-delta.up { color: var(--green); }
.kpi-delta.down { color: var(--red); }

.table-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

table { width: 100%; border-collapse: collapse; }

th {
  text-align: left;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}

.deal-row {
  cursor: pointer;
  transition: background 0.1s;
}

.deal-row:hover, .deal-row.active { background: var(--surface-2); }
.deal-row.active { box-shadow: inset 3px 0 0 var(--accent); }

td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(99, 179, 237, 0.05); }
.company { font-weight: 500; }
.stage { color: var(--text-muted); }
.amount { font-weight: 600; color: var(--green); }
.owner { color: var(--text-muted); }

.how-it-works {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.code-snippet {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  font-size: 12px;
  line-height: 1.65;
  color: #a5d6ff;
  white-space: pre;
  overflow-x: auto;
  margin-top: 8px;
}

.links { display: flex; gap: 16px; margin-top: 12px; }
.links a { font-size: 12px; color: #818cf8; text-decoration: none; }
.links a:hover { text-decoration: underline; }

/* Sidebar */
.sidebar {
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 53px);
  position: sticky;
  top: 53px;
}

.context-panel {
  flex: 0 0 auto;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: background 0.2s;
  flex-shrink: 0;
}

.dot.live {
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.context-box {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #a5d6ff;
  font-family: 'SFMono-Regular', ui-monospace, Menlo, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 70px;
}

.context-box.empty {
  color: var(--text-dim);
  font-family: inherit;
  font-style: italic;
}

.copy-btn {
  margin-top: 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 11px;
  padding: 5px 10px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.copy-btn:hover { border-color: rgba(99, 179, 237, 0.3); color: var(--text); }

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
}

.chat-empty p { font-size: 12px; color: var(--text-dim); line-height: 1.6; }

.message { display: flex; flex-direction: column; gap: 3px; }
.role { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); font-weight: 600; }
.message.user .role { color: #818cf8; }
.message.ai .role { color: var(--green); }

.bubble {
  font-size: 12.5px;
  line-height: 1.6;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.message.user .bubble {
  background: rgba(79, 70, 229, 0.15);
  border-color: rgba(99, 102, 241, 0.25);
  color: #e0e7ff;
}

.bubble.thinking { color: var(--text-dim); font-style: italic; }

.chat-input-row {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid var(--border);
}

.chat-input-row input {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.chat-input-row input:focus { border-color: rgba(99, 102, 241, 0.5); }
.chat-input-row input::placeholder { color: var(--text-dim); }
.chat-input-row input:disabled { opacity: 0.5; }

.chat-input-row button {
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: white;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.chat-input-row button:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-input-row button:not(:disabled):hover { opacity: 0.85; }
</style>
