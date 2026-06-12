import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableMultistepStep {
  /** Step identifier (unique within the flow). */
  id: string;
  /** Human-readable step label. */
  label: string;
  /** Whether this step has been completed. */
  completed: boolean;
  /** Whether this step is currently active. */
  active: boolean;
  /** Optional step description. */
  description?: string;
  /** Whether this step is optional (can be skipped). */
  optional?: boolean;
  /** Validation error message for this step, if any. */
  error?: string | null;
}

export interface AskableMultistepSourceSnapshot {
  /** All steps in the flow, in order. */
  steps: AskableMultistepStep[];
  /** Index of the currently active step (0-based). */
  currentIndex: number;
  /** Total number of steps. */
  totalSteps: number;
  /** Number of completed steps. */
  completedCount: number;
  /** Completion percentage (0-100). */
  progressPercent: number;
  /** Whether the first step is active. */
  isFirstStep: boolean;
  /** Whether the last step is active. */
  isLastStep: boolean;
  /** Whether the entire flow is complete. */
  isComplete: boolean;
  /** ISO timestamp when the flow started. */
  startedAt: string | null;
  /** ISO timestamp when the flow completed. */
  completedAt: string | null;
}

export interface AskableCreateMultistepSourceOptions {
  /**
   * Returns the current multistep snapshot. Called on each resolve.
   * Framework hooks manage step transitions; this getter reads the result.
   */
  getSnapshot: () => AskableMultistepSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableMultistepSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "multistep". */
  kind?: string;
}

function defaultDescribe(snap: AskableMultistepSourceSnapshot): string {
  if (snap.isComplete) return `Flow complete (${snap.totalSteps} steps).`;

  const current = snap.steps[snap.currentIndex];
  const parts: string[] = [];

  parts.push(`Step ${snap.currentIndex + 1} of ${snap.totalSteps}: ${current?.label ?? 'Unknown'}.`);

  if (snap.completedCount > 0) {
    parts.push(`${snap.completedCount} step${snap.completedCount !== 1 ? 's' : ''} completed.`);
  }

  if (current?.error) {
    parts.push(`Error: ${current.error}`);
  }

  if (snap.progressPercent > 0) {
    parts.push(`Progress: ${snap.progressPercent}%.`);
  }

  return parts.join(' ');
}

/**
 * Creates a multistep context source that exposes wizard, stepper, and
 * checkout flow state to AI assistants — enabling them to guide users
 * through complex multi-step processes.
 *
 * @example
 * ```ts
 * // AI: "You're on step 3 of 5 (Payment details). Steps 1 and 2 are complete.
 * //      The billing address field has a validation error."
 * ```
 */
export function createAskableMultistepSource(
  options: AskableCreateMultistepSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'multistep',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Flow state unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Flow state unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        currentIndex: snap?.currentIndex ?? 0,
        totalSteps: snap?.totalSteps ?? 0,
        progressPercent: snap?.progressPercent ?? 0,
        isFirstStep: snap?.isFirstStep ?? true,
        isLastStep: snap?.isLastStep ?? false,
        isComplete: snap?.isComplete ?? false,
      };
    },
    data: () => options.getSnapshot(),
  });
}

export function buildMultistepSnapshot(
  steps: Pick<AskableMultistepStep, 'id' | 'label' | 'completed' | 'active' | 'description' | 'optional' | 'error'>[],
  options: { startedAt?: string | null; completedAt?: string | null } = {},
): AskableMultistepSourceSnapshot {
  const currentIndex = steps.findIndex((s) => s.active);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const completedCount = steps.filter((s) => s.completed).length;
  const isComplete = steps.every((s) => s.completed || s.optional);

  return {
    steps: steps as AskableMultistepStep[],
    currentIndex: activeIndex,
    totalSteps: steps.length,
    completedCount,
    progressPercent: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    isFirstStep: activeIndex === 0,
    isLastStep: activeIndex === steps.length - 1,
    isComplete,
    startedAt: options.startedAt ?? null,
    completedAt: options.completedAt ?? null,
  };
}
