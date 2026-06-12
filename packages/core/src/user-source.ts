import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableUserProfile {
  /** User's display name. */
  name?: string;
  /** User's email address. */
  email?: string;
  /** User's role or permission level (e.g. "admin", "viewer"). */
  role?: string;
  /** User's plan or subscription tier. */
  plan?: string;
  /** Organization or team name. */
  organization?: string;
  /** Locale / language preference (e.g. "en-US"). */
  locale?: string;
  /** Custom properties — any extra fields your app tracks. */
  [key: string]: unknown;
}

export interface AskableCreateUserSourceOptions {
  /** Human-readable description. Defaults to "Logged-in user". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "user". */
  kind?: string;
  /** Function returning the current user profile. */
  getUser: () => AskableUserProfile | null | undefined | Promise<AskableUserProfile | null | undefined>;
  /**
   * Fields to omit from the resolved profile for privacy.
   * Defaults to omitting "email" in summary mode.
   */
  omitFields?: string[];
  /**
   * Transform the user profile before serialization.
   * Useful for renaming or redacting fields.
   */
  sanitize?: (profile: AskableUserProfile) => AskableUserProfile;
}

/**
 * Creates a source that exposes the logged-in user's profile so AI assistants
 * can personalise responses — addressing the user by name, respecting their
 * role and plan, and adapting to their locale.
 *
 * @example
 * ```ts
 * const userSource = createAskableUserSource({
 *   getUser: () => auth.currentUser,
 *   omitFields: ['email'],
 * });
 * ctx.registerSource('user', userSource);
 * ```
 */
export function createAskableUserSource(
  options: AskableCreateUserSourceOptions,
): AskableContextSource {
  const omit = new Set(options.omitFields ?? []);

  async function resolveProfile(): Promise<AskableUserProfile | null> {
    const raw = await Promise.resolve(options.getUser());
    if (!raw) return null;
    const filtered = omit.size > 0
      ? Object.fromEntries(Object.entries(raw).filter(([k]) => !omit.has(k)))
      : raw;
    return options.sanitize ? options.sanitize(filtered) : filtered;
  }

  return createAskableSource({
    kind: options.kind ?? 'user',
    describe: options.describe ?? 'Logged-in user',
    state: async () => {
      const user = await Promise.resolve(options.getUser());
      if (!user) return { authenticated: false };
      return {
        authenticated: true,
        name: user.name,
        role: user.role,
        plan: user.plan,
      };
    },
    data: resolveProfile,
  });
}
