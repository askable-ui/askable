import { useCallback, useMemo, useRef, useState } from 'react';
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
}

export interface UseAskableMultistepSourceResult extends UseAskableSourceResult {
  /** Current multistep snapshot. */
  snapshot: AskableMultistepSourceSnapshot | null;
  /** Navigate to the next step. */
  next: () => void;
  /** Navigate to the previous step. */
  prev: () => void;
  /** Go to a specific step by index. */
  goTo: (index: number) => void;
  /** Mark the current step as complete and advance. */
  complete: () => void;
  /** Set an error on the current step. */
  setError: (error: string | null) => void;
  /** Reset the flow to the initial state. */
  reset: () => void;
}

/**
 * React hook that tracks wizard, stepper, and checkout flow state and exposes
 * it to AI assistants so they can guide users through complex multi-step processes.
 *
 * @example
 * ```tsx
 * const { snapshot, next, setError } = useAskableMultistepSource({
 *   steps: [
 *     { id: 'account', label: 'Account' },
 *     { id: 'payment', label: 'Payment' },
 *     { id: 'review', label: 'Review' },
 *   ],
 * });
 * // AI: "You're on step 2 of 3 (Payment). Step 1 is complete."
 * ```
 */
export function useAskableMultistepSource(
  options: UseAskableMultistepSourceOptions = {},
): UseAskableMultistepSourceResult {
  const { id = 'multistep', steps: initialStepDefs = [], initialStep = 0, describe, kind, enabled, ctx, name, events } = options;

  const startedAtRef = useRef(new Date().toISOString());

  const buildInitial = (): AskableMultistepSourceSnapshot => {
    const steps = initialStepDefs.map((s, i) => ({
      ...s,
      completed: false,
      active: i === initialStep,
      error: null,
    }));
    return buildMultistepSnapshot(steps, { startedAt: startedAtRef.current });
  };

  const [snapshot, setSnapshot] = useState<AskableMultistepSourceSnapshot | null>(buildInitial);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () => createAskableMultistepSource({ describe, kind, getSnapshot: () => snapshotRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });
  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const updateSteps = useCallback((updater: (steps: AskableMultistepStep[]) => AskableMultistepStep[]) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const steps = updater([...prev.steps]);
      return buildMultistepSnapshot(steps, { startedAt: prev.startedAt });
    });
    notifyRef.current();
  }, []);

  const next = useCallback(() => {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0 || idx >= steps.length - 1) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx + 1] = { ...steps[idx + 1], active: true };
      return steps;
    });
  }, [updateSteps]);

  const prev = useCallback(() => {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx <= 0) return steps;
      steps[idx] = { ...steps[idx], active: false };
      steps[idx - 1] = { ...steps[idx - 1], active: true };
      return steps;
    });
  }, [updateSteps]);

  const goTo = useCallback((index: number) => {
    updateSteps((steps) => {
      return steps.map((s, i) => ({ ...s, active: i === index }));
    });
  }, [updateSteps]);

  const complete = useCallback(() => {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], completed: true, active: false, error: null };
      if (idx < steps.length - 1) {
        steps[idx + 1] = { ...steps[idx + 1], active: true };
      }
      return steps;
    });
  }, [updateSteps]);

  const setError = useCallback((error: string | null) => {
    updateSteps((steps) => {
      const idx = steps.findIndex((s) => s.active);
      if (idx < 0) return steps;
      steps[idx] = { ...steps[idx], error };
      return steps;
    });
  }, [updateSteps]);

  const reset = useCallback(() => {
    startedAtRef.current = new Date().toISOString();
    setSnapshot(buildInitial());
    notifyRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...result, snapshot, next, prev, goTo, complete, setError, reset };
}
