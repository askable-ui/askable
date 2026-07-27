import { $, useSignal } from '@builder.io/qwik';
import type { QRL } from '@builder.io/qwik';
import { createAskableMultistepSource, buildMultistepSnapshot } from '@askable-ui/core';
import type {
  AskableCreateMultistepSourceOptions,
  AskableMultistepStep,
  AskableMultistepSourceSnapshot,
} from '@askable-ui/core';
import {
  useAskableSource,
  type UseAskableSourceOptions,
  type UseAskableSourceResult,
} from './useAskableSource.js';

export type { AskableMultistepStep, AskableMultistepSourceSnapshot };

type StepDefinition = Pick<
  AskableMultistepStep,
  'id' | 'label' | 'description' | 'optional'
>;

export interface UseAskableMultistepSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateMultistepSourceOptions, 'describe' | 'getSnapshot'> {
  id?: string;
  steps?: StepDefinition[];
  initialStep?: number;
  /** Resume-safe source description callback. */
  describe?: string | QRL<Extract<
    NonNullable<AskableCreateMultistepSourceOptions['describe']>,
    (...args: never[]) => unknown
  >>;
}

export interface UseAskableMultistepSourceResult extends UseAskableSourceResult {
  snapshot: ReturnType<typeof useSignal<AskableMultistepSourceSnapshot | null>>;
  next: QRL<() => Promise<void>>;
  prev: QRL<() => Promise<void>>;
  goTo: QRL<(indexOrId: number | string) => Promise<void>>;
  setSteps: QRL<(steps: StepDefinition[]) => Promise<void>>;
}

function makeSteps(definitions: StepDefinition[], activeIndex: number): AskableMultistepStep[] {
  return definitions.map((step, index) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    optional: step.optional,
    completed: index < activeIndex,
    active: index === activeIndex,
  }));
}

function definitionsFromSnapshot(
  snapshot: AskableMultistepSourceSnapshot | null,
  fallback: StepDefinition[],
): StepDefinition[] {
  return snapshot?.steps.map((step) => ({
    id: step.id,
    label: step.label,
    description: step.description,
    optional: step.optional,
  })) ?? fallback;
}

async function applyIndex(
  snapshotSignal: ReturnType<typeof useSignal<AskableMultistepSourceSnapshot | null>>,
  definitions: StepDefinition[],
  index: number,
  notifyChanged: QRL<() => void>,
): Promise<void> {
  if (index < 0 || index >= definitions.length) return;
  snapshotSignal.value = buildMultistepSnapshot(makeSteps(definitions, index));
  await notifyChanged();
}

/** Qwik hook that tracks wizard progress and exposes resumable actions. */
export function useAskableMultistepSource(
  options: UseAskableMultistepSourceOptions = {},
): UseAskableMultistepSourceResult {
  const {
    id = 'multistep',
    steps: initialSteps = [],
    initialStep = 0,
    describe,
    kind,
    enabled,
    ctx,
    ctx$,
    name,
    events,
    viewport,
    textExtractor,
    sanitizeMeta,
    sanitizeText,
    sanitizeSource,
    maxHistory,
  } = options;

  const snapshot = useSignal<AskableMultistepSourceSnapshot | null>(
    initialSteps.length > 0
      ? buildMultistepSnapshot(makeSteps(initialSteps, initialStep))
      : null,
  );
  const sourceFactory = $(async () => createAskableMultistepSource({
    describe: typeof describe === 'string' ? describe : await describe?.resolve(),
    kind,
    getSnapshot: () => snapshot.value,
  }));
  const result = useAskableSource(id, sourceFactory, {
    enabled, ctx, ctx$, name, events, viewport, textExtractor,
    sanitizeMeta, sanitizeText, sanitizeSource, maxHistory,
  });
  const notifyChanged = result.notifyChanged;

  const next = $(async (): Promise<void> => {
    const definitions = definitionsFromSnapshot(snapshot.value, initialSteps);
    const currentIndex = snapshot.value?.currentIndex ?? initialStep;
    await applyIndex(snapshot, definitions, currentIndex + 1, notifyChanged);
  });

  const prev = $(async (): Promise<void> => {
    const definitions = definitionsFromSnapshot(snapshot.value, initialSteps);
    const currentIndex = snapshot.value?.currentIndex ?? initialStep;
    await applyIndex(snapshot, definitions, currentIndex - 1, notifyChanged);
  });

  const goTo = $(async (indexOrId: number | string): Promise<void> => {
    const definitions = definitionsFromSnapshot(snapshot.value, initialSteps);
    const index = typeof indexOrId === 'number'
      ? indexOrId
      : definitions.findIndex((step) => step.id === indexOrId);
    await applyIndex(snapshot, definitions, index, notifyChanged);
  });

  const setSteps = $(async (steps: StepDefinition[]): Promise<void> => {
    snapshot.value = buildMultistepSnapshot(makeSteps(steps, 0));
    await notifyChanged();
  });

  return Object.assign(result, { snapshot, next, prev, goTo, setSteps });
}
