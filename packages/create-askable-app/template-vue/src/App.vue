<template>
  <div class="layout">
    <main>
      <h1>__APP_NAME__</h1>
      <p>Click any card to see what the AI sees.</p>

      <div class="cards">
        <Askable
          v-for="item in items"
          :key="item.label"
          as="article"
          :meta="item"
          class="card"
        >
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </Askable>
      </div>
    </main>

    <aside>
      <h2>AI Context</h2>
      <pre>{{ promptContext || 'Click a card to see AI context' }}</pre>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { Askable, useAskable } from '@askable-ui/vue';

const items = [
  { label: 'Revenue', value: '$2.4M' },
  { label: 'Users', value: '18,400' },
  { label: 'Churn', value: '2.1%' },
];

const { promptContext } = useAskable();
</script>

<style>
* { box-sizing: border-box; margin: 0; }
body { font-family: system-ui, sans-serif; background: #f9fafb; }
.layout { display: flex; gap: 2rem; padding: 2rem; max-width: 1200px; margin: 0 auto; }
main { flex: 1; }
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
p { color: #6b7280; margin-bottom: 1.5rem; }
.cards { display: flex; gap: 1rem; flex-wrap: wrap; }
.card { padding: 1.5rem 2rem; border: 1px solid #e5e7eb; border-radius: 12px;
        background: #fff; cursor: pointer; transition: border-color 0.15s; display: flex; flex-direction: column; gap: 0.25rem; }
.card:hover { border-color: #6366f1; }
.label { font-size: 0.875rem; color: #6b7280; }
.value { font-size: 1.75rem; font-weight: 700; }
aside { width: 340px; flex-shrink: 0; }
h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
pre { background: #f3f4f6; border-radius: 8px; padding: 1rem; font-size: 0.75rem;
      white-space: pre-wrap; min-height: 120px; }
</style>
