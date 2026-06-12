import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableErrorEntry {
  /** Field name, component path, or error key. */
  key: string;
  /** Error message or messages. */
  message: string | string[];
  /** Optional error code or type for programmatic handling. */
  code?: string;
  /** Severity level. Defaults to "error". */
  severity?: 'error' | 'warning' | 'info';
}

export interface AskableErrorSourceSnapshot {
  errors: AskableErrorEntry[];
  warnings: AskableErrorEntry[];
  total: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface AskableCreateErrorSourceOptions {
  /** Human-readable description. Defaults to "Application errors". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "errors". */
  kind?: string;
  /** Function that returns the current list of errors. */
  getErrors: () => readonly AskableErrorEntry[] | Promise<readonly AskableErrorEntry[]>;
}

/**
 * Creates a source that exposes application error state — form validation errors,
 * API failure messages, error boundary catches — so an AI assistant can
 * diagnose problems and guide the user to resolution.
 *
 * Call `notifyChanged()` on the returned handle whenever errors change, or use
 * the framework hook which does this automatically.
 *
 * @example
 * ```ts
 * const errorSource = createAskableErrorSource({
 *   getErrors: () => Object.entries(formErrors).map(([key, message]) => ({ key, message })),
 * });
 * ctx.registerSource('errors', errorSource);
 * ```
 */
export function createAskableErrorSource(
  options: AskableCreateErrorSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'errors',
    describe: options.describe ?? 'Application errors',
    state: async () => {
      const errors = await Promise.resolve(options.getErrors());
      const errCount = errors.filter((e) => (e.severity ?? 'error') === 'error').length;
      const warnCount = errors.filter((e) => e.severity === 'warning').length;
      return {
        total: errors.length,
        errorCount: errCount,
        warningCount: warnCount,
        hasErrors: errCount > 0,
      };
    },
    data: async () => {
      const entries = await Promise.resolve(options.getErrors());
      const errors = entries.filter((e) => (e.severity ?? 'error') === 'error');
      const warnings = entries.filter((e) => e.severity === 'warning');
      const snapshot: AskableErrorSourceSnapshot = {
        errors,
        warnings,
        total: entries.length,
        hasErrors: errors.length > 0,
        hasWarnings: warnings.length > 0,
      };
      return snapshot;
    },
  });
}
