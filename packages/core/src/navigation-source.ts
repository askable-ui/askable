import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableNavigationEntry {
  /** The URL path including query string and hash. */
  path: string;
  /** Page title at the time of navigation. */
  title?: string;
  /** ISO timestamp of when the navigation occurred. */
  timestamp: string;
}

export interface AskableNavigationSourceSnapshot {
  /** Current path (pathname + search + hash). */
  currentPath: string;
  /** Current page title. */
  currentTitle: string | null;
  /** Extracted route parameters (populated when `getParams` is provided). */
  params: Record<string, string> | null;
  /** Extracted query string as key-value pairs. */
  query: Record<string, string>;
  /** Navigation history, newest entry first. */
  history: AskableNavigationEntry[];
}

export interface AskableCreateNavigationSourceOptions {
  /**
   * Returns the current path. Defaults to `window.location.pathname + search + hash`.
   * Override to integrate with your router's reactive path.
   * @example () => location.pathname  // basic
   * @example () => route.fullPath      // Vue Router
   */
  getPath?: () => string;
  /**
   * Returns the current page title. Defaults to `document.title`.
   */
  getTitle?: () => string | null;
  /**
   * Returns route parameters as a plain object.
   * @example () => useParams()  // React Router v6
   * @example () => route.params // Vue Router (cast to Record<string, string>)
   */
  getParams?: () => Record<string, string> | null;
  /**
   * Maximum number of navigation history entries to retain.
   * @default 10
   */
  maxHistory?: number;
  /**
   * Custom describe function. Receives the current snapshot and returns a string.
   */
  describe?: (snapshot: AskableNavigationSourceSnapshot) => string;
  /** Source category. Defaults to "navigation". */
  kind?: string;
}

function defaultGetPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search + window.location.hash;
}

function defaultGetTitle(): string | null {
  if (typeof document === 'undefined') return null;
  return document.title || null;
}

function parseQuery(path: string): Record<string, string> {
  const idx = path.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(path.slice(idx + 1));
  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}

function buildDefaultDescribe(snapshot: AskableNavigationSourceSnapshot): string {
  const lines: string[] = [`Current route: ${snapshot.currentPath}`];

  if (snapshot.currentTitle) lines.push(`Page title: ${snapshot.currentTitle}`);

  if (snapshot.params && Object.keys(snapshot.params).length > 0) {
    lines.push(`Route params: ${Object.entries(snapshot.params).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  if (Object.keys(snapshot.query).length > 0) {
    lines.push(`Query params: ${Object.entries(snapshot.query).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  if (snapshot.history.length > 1) {
    const trail = snapshot.history.slice(1, 6).map((e) => e.path).join(' → ');
    lines.push(`Previous routes: ${trail}`);
  }

  return lines.join('\n');
}

/**
 * Creates a navigation context source that exposes the current route, title,
 * route parameters, query string, and navigation history so AI assistants can
 * understand where the user is in the application.
 *
 * Works with any router — pass a `getPath` getter that reads from your router's
 * reactive state and call `notifyChanged()` whenever the route changes.
 *
 * @example
 * ```ts
 * // Plain (reads window.location)
 * const source = createAskableNavigationSource();
 *
 * // React Router v6
 * const location = useLocation();
 * const params = useParams();
 * const source = createAskableNavigationSource({
 *   getPath: () => location.pathname + location.search,
 *   getParams: () => params,
 * });
 *
 * // Vue Router
 * const route = useRoute();
 * const source = createAskableNavigationSource({
 *   getPath: () => route.fullPath,
 *   getParams: () => route.params as Record<string, string>,
 * });
 * ```
 */
export function createAskableNavigationSource(
  options: AskableCreateNavigationSourceOptions = {},
): AskableContextSource {
  const {
    getPath = defaultGetPath,
    getTitle = defaultGetTitle,
    getParams,
    maxHistory = 10,
    describe,
    kind = 'navigation',
  } = options;

  const history: AskableNavigationEntry[] = [];

  function buildSnapshot(): AskableNavigationSourceSnapshot {
    const currentPath = getPath();
    const currentTitle = getTitle?.() ?? null;
    const params = getParams?.() ?? null;
    const query = parseQuery(currentPath);

    const latest = history[0];
    if (!latest || latest.path !== currentPath) {
      history.unshift({
        path: currentPath,
        title: currentTitle ?? undefined,
        timestamp: new Date().toISOString(),
      });
      if (history.length > maxHistory) history.length = maxHistory;
    }

    return { currentPath, currentTitle, params, query, history: [...history] };
  }

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot())
      : () => buildDefaultDescribe(buildSnapshot()),
    state: () => {
      const snapshot = buildSnapshot();
      return {
        currentPath: snapshot.currentPath,
        title: snapshot.currentTitle,
        historyLength: snapshot.history.length,
      };
    },
    data: () => buildSnapshot(),
  });
}
