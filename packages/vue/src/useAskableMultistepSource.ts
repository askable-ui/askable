import { ref, type MaybeRef } from 'vue';
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
  /** Source registration id. Defaults to "multistep". */
  id?: string;
  /** Initial step definitions. */
  steps?: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[];
  /** Index of the initially active step. @default 0 */
  initialStep?: number;
  enabled?: MaybeRef<boolean>;
}

export interface UseAskableMultistepSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof ref<AskableMultistepSourceSnapshot | null>>;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  complete: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Vue composable that tracks wizard and stepper flow state and exposes it to
 * AI assistants so they can guide users through multi-step processes.
 *
 * @example
 * ```ts
 * const { snapshot, next, complete } = useAskableMultistepSource({
 *   steps: [{ id: 'info', label: 'Info' }, { id: 'payment', label: 'Payment' }],
 * });
 * ```
 */
export function useAskableMultistepSource(
  options: UseAskableMultistepSourceOptions = {},
): UseAskableMultistepSourceResult {
  const { id = 'multistep', steps: initialStepDefs = [], initialStep = 0, describe, kind, enabled, ctx, name, events } = options;

  const startedAt = new Date().toISOString();

  const makeInitialSteps = (): AskableMultistepStep[] =>
    initialStepDefs.map((s, i) => ({ ...s, completed: false, active: i === initialStep, error: null }));

  const snapshot = ref<AskableMultistepSourceSnapshot | null>(
    buildMultistepSnapshot(makeInitialSteps(), { startedAt }),
  );

  const source = createAskableMultistepSource({ describe, kind, getSnapshot: () => snapshot.value });
  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function updateSteps(updater: (steps: AskableMultistepStep[]) => AskableMultistepStep[]): void {
    if (!snapshot.value) return;
    const steps = updater([...snapshot.value.steps]);
    snapshot.value = buildMultistepSnapshot(steps, { startedAt: snapshot.value.startedAt });
    result.notifyChanged();
  }

  function next(): void {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0 || idx >= steps.length - 1) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx + 1] = { ...steps[idx + 1], active: true };
      return steps;
    });
  }

  function prev(): void {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx <= 0) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx - 1] = { ...steps[idx - 1], active: true };
      return steps;
    });
  }

  function goTo(index: number): void {
    updateSteps((steps) => steps.map((s, i) => ({ ...s, active: i === index })));
  }

  function complete(): void {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], completed: true, active: false, error: null };
      if (idx < steps.length - 1) steps[idx + 1] = { ...steps[idx + 1], active: true };
      return steps;
    });
  }

  function setError(error: string | null): void {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], error };
      return steps;
    });
  }

  function reset(): void {
    snapshot.value = buildMultistepSnapshot(makeInitialSteps(), { startedAt: new Date().toISOString() });
    result.notifyChanged();
  }

  return { ...result, snapshot, next, prev, goTo, complete, setError, reset };
}
