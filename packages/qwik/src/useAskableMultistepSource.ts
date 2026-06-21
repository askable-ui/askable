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
 * Qwik hook that tracks wizard / stepper / checkout flow progress.
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

  function makeSteps(defs: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[], activeIdx: number): AskableMultistepStep[] {
    return defs.map((s, i) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      optional: s.optional,
      completed: i < activeIdx,
      active: i === activeIdx,
    }));
  }

  const snapshot = useSignal<AskableMultistepSourceSnapshot | null>(
    initialSteps.length > 0 ? buildMultistepSnapshot(makeSteps(initialSteps, initialStep)) : null,
  );

  const source = createAskableMultistepSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function currentDefs(): Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[] {
    return snapshot.value?.steps.map((s) => ({ id: s.id, label: s.label, description: s.description, optional: s.optional })) ?? initialSteps;
  }

  function currentIndex(): number {
    return snapshot.value?.currentIndex ?? initialStep;
  }

  function applyIndex(defs: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[], idx: number): void {
    if (idx < 0 || idx >= defs.length) return;
    snapshot.value = buildMultistepSnapshot(makeSteps(defs, idx));
    result.notifyChanged();
  }

  function next(): void { applyIndex(currentDefs(), currentIndex() + 1); }
  function prev(): void { applyIndex(currentDefs(), currentIndex() - 1); }

  function goTo(indexOrId: number | string): void {
    const defs = currentDefs();
    if (typeof indexOrId === 'number') { applyIndex(defs, indexOrId); return; }
    const idx = defs.findIndex((s) => s.id === indexOrId);
    if (idx >= 0) applyIndex(defs, idx);
  }

  function setSteps(steps: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[]): void {
    snapshot.value = buildMultistepSnapshot(makeSteps(steps, 0));
    result.notifyChanged();
  }

  return { ...result, snapshot, next, prev, goTo, setSteps };
}
