import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableAbTestVariant {
  /** Experiment / test name (e.g. "checkout_flow_v2"). */
  experiment: string;
  /** Variant the user is assigned to (e.g. "control", "treatment", "B"). */
  variant: string;
  /** Whether this user is in the control group. */
  isControl: boolean;
}

export interface AskableAbTestSourceSnapshot {
  /** All active experiments and their assigned variants. */
  experiments: AskableAbTestVariant[];
  /** Names of experiments the user is in a non-control variant. */
  treatments: string[];
  /** Names of experiments the user is in the control group. */
  controls: string[];
}

export interface AskableCreateAbTestSourceOptions {
  /**
   * Returns the current A/B test assignments. Called each time the source is
   * resolved. Compatible with Optimizely, LaunchDarkly experiments, PostHog
   * experiments, Statsig, GrowthBook, or any custom A/B framework.
   *
   * @example
   * // Optimizely
   * getExperiments: () => optimizely.getEnabledFeatures().map(...)
   * // PostHog
   * getExperiments: () => Object.entries(posthog.featureFlags.getFlags())
   *   .filter(([, v]) => typeof v === 'string')
   *   .map(([k, v]) => ({ experiment: k, variant: v as string, isControl: v === 'control' }))
   */
  getExperiments: () => AskableAbTestVariant[] | null | undefined;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableAbTestSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "ab-tests". */
  kind?: string;
}

function toSnapshot(variants: AskableAbTestVariant[]): AskableAbTestSourceSnapshot {
  return {
    experiments: variants,
    treatments: variants.filter((v) => !v.isControl).map((v) => v.experiment),
    controls: variants.filter((v) => v.isControl).map((v) => v.experiment),
  };
}

function defaultDescribe(snap: AskableAbTestSourceSnapshot): string {
  if (snap.experiments.length === 0) return 'No A/B experiments active.';
  const lines = snap.experiments.map((e) => `${e.experiment}: ${e.variant}`);
  return `${snap.experiments.length} experiment${snap.experiments.length !== 1 ? 's' : ''} active. ${lines.join('; ')}.`;
}

/**
 * Creates a source that exposes A/B test variant assignments to AI assistants
 * so they can explain why the user sees a different UI variant or answer
 * questions about feature availability under test conditions.
 *
 * Compatible with Optimizely, LaunchDarkly, PostHog experiments, Statsig,
 * GrowthBook, or any custom A/B framework.
 *
 * @example
 * ```ts
 * const abSource = createAskableAbTestSource({
 *   getExperiments: () => [
 *     { experiment: 'checkout_flow', variant: 'v2', isControl: false },
 *     { experiment: 'pricing_page', variant: 'control', isControl: true },
 *   ],
 * });
 * ctx.registerSource('ab-tests', abSource);
 * ```
 */
export function createAskableAbTestSource(
  options: AskableCreateAbTestSourceOptions,
): AskableContextSource {
  function resolve(): AskableAbTestSourceSnapshot | null {
    const raw = options.getExperiments();
    if (!raw) return null;
    return toSnapshot(raw);
  }

  return createAskableSource({
    kind: options.kind ?? 'ab-tests',
    describe: options.describe
      ? async () => {
          const snap = resolve();
          if (!snap) return 'No A/B experiments active.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = resolve();
          return snap ? defaultDescribe(snap) : 'No A/B experiments active.';
        },
    state: () => {
      const snap = resolve();
      return {
        totalExperiments: snap?.experiments.length ?? 0,
        treatmentCount: snap?.treatments.length ?? 0,
        controlCount: snap?.controls.length ?? 0,
      };
    },
    data: resolve,
  });
}
