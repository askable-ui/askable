<template>
  <div class="layout">
    <main>
      <h1>__APP_NAME__</h1>
      <p>Click any card, then ask AI about it.</p>

      <div class="cards">
        <Askable
          v-for="item in items"
          :key="item.label"
          as="article"
          :meta="item"
          class="card"
          :class="{ active: focus?.meta?.label === item.label }"
        >
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </Askable>
      </div>

      <div v-if="response" class="response">
        <strong>AI: </strong>{{ response }}
      </div>
    </main>

    <aside>
      <h2>Ask AI</h2>
      <div class="ask-panel">
        <pre>{{ promptContext || 'Click a card to see AI context' }}</pre>
        <button
          class="ask-btn"
          :disabled="status === 'pending' || !promptContext"
          @click="handleAsk"
        >
          {{ status === 'pending' ? 'Thinking…' : 'Ask AI about this' }}
        </button>
        <div v-if="status === 'error'" class="error">Request failed — check console</div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Askable, useAskable, useAskableAgent } from '@askable-ui/vue';

const items = [
  { label: 'Revenue', value: '$2.4M', delta: '+12%' },
  { label: 'Users', value: '18,400', delta: '+8%' },
  { label: 'Churn', value: '2.1%', delta: '-0.3%' },
];

const { focus, promptContext } = useAskable();
const { send, status } = useAskableAgent();
const response = ref('');

async function handleAsk() {
  response.value = '';
  const result = await send('What is this metric and what does it mean?', async (req) => {
    // Replace with your actual API call:
    // const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(req) });
    // return res.json();

    // Demo: echo the context back
    return `Context received (${req.context.length} chars). Connect /api/chat to get real AI responses.`;
  });
  if (result) response.value = String(result);
}
</script>

<style>
* { box-sizing: border-box; margin: 0; }
body { font-family: system-ui, sans-serif; background: #f9fafb; }
.layout { display: flex; gap: 2rem; padding: 2rem; max-width: 1200px; margin: 0 auto; }
main { flex: 1; }
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
p { color: #6b7280; margin-bottom: 1.5rem; }
.cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.card { padding: 1.5rem 2rem; border: 2px solid #e5e7eb; border-radius: 12px;
        background: #fff; cursor: pointer; transition: border-color 0.15s; display: flex; flex-direction: column; gap: 0.25rem; }
.card:hover { border-color: #6366f1; }
.card.active { border-color: #6366f1; background: #f5f3ff; }
.label { font-size: 0.875rem; color: #6b7280; }
.value { font-size: 1.75rem; font-weight: 700; }
.response { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 1rem; font-size: 0.875rem; }
aside { width: 340px; flex-shrink: 0; }
h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
.ask-panel { display: flex; flex-direction: column; gap: 0.75rem; }
pre { background: #f3f4f6; border-radius: 8px; padding: 1rem; font-size: 0.75rem;
      white-space: pre-wrap; min-height: 120px; }
.ask-btn { padding: 0.625rem 1.25rem; background: #6366f1; color: #fff; border: none;
           border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
.ask-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.error { color: #ef4444; font-size: 0.875rem; }
</style>
