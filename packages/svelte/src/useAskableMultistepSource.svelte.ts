import { createAskableMultistepSource, buildMultistepSnapshot } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateMultistepSourceOptions,
  AskableMultistepStep,
  AskableMultistepSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableMultistepStep, AskableMultistepSourceSnapshot };

export interface UseAskableMultistepSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateMultistepSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "multistep". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Initial step definitions. */
  steps?: Pick<AskableMultistepStep, 'id' | 'label' | 'description' | 'optional'>[];
  /** Index of the initially active step. @default 0 */
  initialStep?: number;
}

export interface UseAskableMultistepSource extends UseAskableSource {
  readonly snapshot: AskableMultistepSourceSnapshot | null;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  complete: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Svelte 5 runes-based composable that tracks wizard and stepper flow state
 * and exposes it to AI assistants so they can guide users through multi-step processes.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableMultistepSource } from '@askable-ui/svelte/useAskableMultistepSource.svelte';
 *   const { snapshot, next, complete } = useAskableMultistepSource({
 *     steps: [{ id: 'info', label: 'Info' }, { id: 'payment', label: 'Payment' }],
 *   });
 * </script>
 * ```
 */
export function useAskableMultistepSource(
  options: UseAskableMultistepSourceOptions = {},
): UseAskableMultistepSource {
  const {
    id = 'multistep',
    steps: initialStepDefs = [],
    initialStep = 0,
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let startedAt = new Date().toISOString();

  const makeInitialSteps = (): AskableMultistepStep[] =>
    initialStepDefs.map((s, i) => ({ ...s, completed: false, active: i === initialStep, error: null }));

  let snapshot = $state<AskableMultistepSourceSnapshot | null>(
    buildMultistepSnapshot(makeInitialSteps(), { startedAt }),
  );

  const multiSource = createAskableMultistepSource({ describe, kind, getSnapshot: () => snapshot });
  const result = useAskableSource(id, { ...multiSource, ...ctxOptions, ctx, observe, enabled });

  function updateSteps(updater: (steps: AskableMultistepStep[]) => AskableMultistepStep[]): void {
    if (!snapshot) return;
    const steps = updater([...snapshot.steps]);
    snapshot = buildMultistepSnapshot(steps, { startedAt: snapshot.startedAt });
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
    startedAt = new Date().toISOString();
    snapshot = buildMultistepSnapshot(makeInitialSteps(), { startedAt });
    result.notifyChanged();
  }

  return { ...result, next, prev, goTo, complete, setError, reset, get snapshot() { return snapshot; } };
}
