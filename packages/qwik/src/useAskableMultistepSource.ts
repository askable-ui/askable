import { useSignal } from '@builder.io/qwik';
import { createAskableMultistepSource, buildMultistepSnapshot } from '@askable-ui/core';
import type {
  AskableCreateMultistepSourceOptions,
  AskableMultistepStep,
  AskableMultistepSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableMultistepStep, AskableMultistepSourceSnapshot };

export interface UseAskableMultistepSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateMultistepSourceOptions, 'getSnapshot'> {
  id?: string;
  steps?: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[];
  initialStep?: number;
}

export interface UseAskableMultistepSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof useSignal<AskableMultistepSourceSnapshot | null>>;
  next(): void;
  prev(): void;
  goTo(indexOrId: number | string): void;
  setSteps(steps: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[]): void;
}

/**
 * Qwik hook that tracks wizard / stepper / checkout flow progress and exposes
 * it to AI assistants.
 *
 * ```tsx
 * export const Checkout = component$(() => {
 *   const wizard = useAskableMultistepSource({
 *     steps: [
 *       { id: 'cart', label: 'Cart' },
 *       { id: 'shipping', label: 'Shipping' },
 *       { id: 'payment', label: 'Payment' },
 *     ],
 *   });
 *   return (
 *     <div>
 *       <p>Step {wizard.snapshot.value?.currentIndex + 1}</p>
 *       <button onClick$={() => wizard.next()}>Next</button>
 *     </div>
 *   );
 * });
 * ```
 */
export function useAskableMultistepSource(options: UseAskableMultistepSourceOptions = {}): UseAskableMultistepSourceResult {
  const { id = 'multistep', steps: initialSteps = [], initialStep = 0, describe, kind, enabled, ctx, name, events } = options;

  const fullSteps: AskableMultistepStep[] = initialSteps.map((s, i) => ({
    ...s,
    index: i,
    isComplete: false,
    isActive: i === initialStep,
    isCurrent: i === initialStep,
  }));

  const snapshot = useSignal<AskableMultistepSourceSnapshot | null>(
    fullSteps.length > 0 ? buildMultistepSnapshot(fullSteps, initialStep, new Date().toISOString()) : null,
  );

  const source = createAskableMultistepSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function currentSteps(): AskableMultistepStep[] {
    return snapshot.value?.steps ?? fullSteps;
  }

  function currentIndex(): number {
    return snapshot.value?.currentIndex ?? initialStep;
  }

  function applyIndex(idx: number): void {
    const steps = currentSteps();
    if (idx < 0 || idx >= steps.length) return;
    snapshot.value = buildMultistepSnapshot(steps, idx, new Date().toISOString());
    result.notifyChanged();
  }

  function next(): void { applyIndex(currentIndex() + 1); }
  function prev(): void { applyIndex(currentIndex() - 1); }

  function goTo(indexOrId: number | string): void {
    if (typeof indexOrId === 'number') { applyIndex(indexOrId); return; }
    const idx = currentSteps().findIndex((s) => s.id === indexOrId);
    if (idx >= 0) applyIndex(idx);
  }

  function setSteps(steps: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[]): void {
    const full: AskableMultistepStep[] = steps.map((s, i) => ({
      ...s,
      index: i,
      isComplete: false,
      isActive: i === 0,
      isCurrent: i === 0,
    }));
    snapshot.value = buildMultistepSnapshot(full, 0, new Date().toISOString());
    result.notifyChanged();
  }

  return { ...result, snapshot, next, prev, goTo, setSteps };
}
