<script lang="ts">
  import { useAskable } from '@askable-ui/svelte/useAskable.svelte';
  import Askable5 from '@askable-ui/svelte/Askable5.svelte';

  // --- Data ---
  const metrics = [
    {
      id: 'nrr',
      label: 'Net Revenue Retention',
      value: '118%',
      delta: '+4pp vs last quarter',
      positive: true,
      meta: { metric: 'nrr', value: 118, unit: 'percent', benchmark: 110 },
    },
    {
      id: 'pipeline',
      label: 'Pipeline Coverage',
      value: '$4.2M',
      delta: '3.1× quota',
      positive: true,
      meta: { metric: 'pipeline', value: 4200000, unit: 'usd', multiplier: 3.1 },
    },
    {
      id: 'backlog',
      label: 'Support Backlog',
      value: '47',
      delta: '+12 vs last week',
      positive: false,
      meta: { metric: 'backlog', value: 47, unit: 'tickets', weekDelta: 12 },
    },
  ];

  const deals = [
    { id: 'd1', company: 'Acme Corp', stage: 'Proposal', value: '$85,000', owner: 'Sara K.', risk: 'low' },
    { id: 'd2', company: 'Globex Inc', stage: 'Negotiation', value: '$210,000', owner: 'Tom R.', risk: 'medium' },
    { id: 'd3', company: 'Initech', stage: 'Discovery', value: '$42,000', owner: 'Amy J.', risk: 'high' },
    { id: 'd4', company: 'Umbrella Ltd', stage: 'Closed Won', value: '$130,000', owner: 'Dan W.', risk: 'low' },
  ];

  const riskColor: Record<string, string> = {
    low: '#16a34a',
    medium: '#d97706',
    high: '#dc2626',
  };

  // --- Askable ---
  const askable = useAskable({ observe: true });

  let activeId: string | null = $state(null);
  let chatMessages: { role: 'user' | 'ai'; text: string }[] = $state([
    { role: 'ai', text: 'Hello! Click any metric or deal row then ask me about it.' },
  ]);
  let chatInput = $state('');
  let sending = $state(false);

  function focusEl(el: EventTarget | null, id: string) {
    if (el instanceof HTMLElement) {
      askable.ctx.select(el);
      activeId = id;
    }
  }

  function clearFocus() {
    askable.ctx.clear();
    activeId = null;
  }

  function copyContext() {
    navigator.clipboard.writeText(askable.promptContext ?? '').catch(() => undefined);
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || sending) return;
    chatInput = '';
    chatMessages = [...chatMessages, { role: 'user', text }];
    sending = true;

    // Mock AI response using the actual context
    await new Promise<void>((r) => setTimeout(r, 700));
    const ctx = askable.promptContext;
    let reply = "I don't see anything focused — click a metric or deal row first.";
    if (ctx) {
      if (text.toLowerCase().includes('explain') || text.toLowerCase().includes('what')) {
        reply = `Based on the current context:\n\n${ctx}\n\nIs there something specific you'd like me to dig into?`;
      } else if (text.toLowerCase().includes('risk') || text.toLowerCase().includes('concern')) {
        reply = `Looking at the focused element:\n\n${ctx}\n\nWould you like recommendations on how to address this?`;
      } else {
        reply = `Here's what I can see:\n\n${ctx}`;
      }
    }
    chatMessages = [...chatMessages, { role: 'ai', text: reply }];
    sending = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="app">
  <!-- Left: Dashboard -->
  <main class="dashboard">
    <header class="dash-header">
      <div>
        <h1>Revenue Dashboard</h1>
        <p class="subtitle">Q2 2026 · Real-time AI context via <code>askable-ui</code></p>
      </div>
      {#if activeId}
        <button class="btn-clear" onclick={clearFocus}>Clear focus ✕</button>
      {/if}
    </header>

    <!-- KPI Cards -->
    <section class="metrics-grid">
      {#each metrics as m (m.id)}
        <Askable5 meta={m.meta}>
          <button
            class="metric-card"
            class:active={activeId === m.id}
            onclick={(e) => focusEl(e.currentTarget, m.id)}
            type="button"
          >
            <span class="metric-label">{m.label}</span>
            <span class="metric-value">{m.value}</span>
            <span class="metric-delta" class:positive={m.positive} class:negative={!m.positive}>
              {m.delta}
            </span>
          </button>
        </Askable5>
      {/each}
    </section>

    <!-- Deals Table -->
    <section class="table-section">
      <h2>Priority Pipeline</h2>
      <table class="deals-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Stage</th>
            <th>Value</th>
            <th>Owner</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {#each deals as deal (deal.id)}
            <tr
              class="deal-row"
              class:active={activeId === deal.id}
              onclick={(e) => focusEl(e.currentTarget, deal.id)}
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && focusEl(e.currentTarget, deal.id)}
              data-askable={JSON.stringify({ company: deal.company, stage: deal.stage, value: deal.value, owner: deal.owner, risk: deal.risk })}
            >
              <td class="company">{deal.company}</td>
              <td>{deal.stage}</td>
              <td class="value">{deal.value}</td>
              <td>{deal.owner}</td>
              <td>
                <span class="risk-badge" style="color: {riskColor[deal.risk]}">
                  {deal.risk}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <div class="tip">
      <strong>Try it:</strong> Click any card or row, then ask the AI assistant about what you see.
    </div>
  </main>

  <!-- Right: AI Panel -->
  <aside class="ai-panel">
    <!-- Context viewer -->
    <div class="context-box">
      <div class="context-header">
        <span class="context-label">What the AI sees</span>
        {#if askable.promptContext}
          <button class="btn-copy" onclick={copyContext} type="button">copy</button>
        {/if}
      </div>
      <pre class="context-pre">{askable.promptContext || '— nothing focused yet —'}</pre>
    </div>

    <!-- Chat -->
    <div class="chat">
      <div class="chat-messages">
        {#each chatMessages as msg (msg)}
          <div class="message" class:user={msg.role === 'user'} class:ai={msg.role === 'ai'}>
            <span class="msg-role">{msg.role === 'ai' ? '🤖 AI' : 'You'}</span>
            <p class="msg-text">{msg.text}</p>
          </div>
        {/each}
        {#if sending}
          <div class="message ai">
            <span class="msg-role">🤖 AI</span>
            <p class="msg-text typing">thinking…</p>
          </div>
        {/if}
      </div>

      <div class="chat-input-row">
        <textarea
          bind:value={chatInput}
          onkeydown={handleKeydown}
          placeholder="Ask about the focused element…"
          rows="2"
          disabled={sending}
        ></textarea>
        <button class="btn-send" onclick={sendMessage} disabled={sending} type="button">
          Send
        </button>
      </div>
    </div>
  </aside>
</div>

<style>
  /* Import from style.css via main.ts */
</style>
