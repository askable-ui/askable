import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export type AskableConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'closed';

export type AskableConnectionProtocol = 'websocket' | 'sse' | 'polling' | 'long-polling' | 'custom';

export interface AskableConnectionSourceSnapshot {
  /** Current connection status. */
  status: AskableConnectionStatus;
  /** Whether the connection is currently active and usable. */
  isConnected: boolean;
  /** Whether a connection attempt is in progress. */
  isConnecting: boolean;
  /** Whether the client is attempting to reconnect after a drop. */
  isReconnecting: boolean;
  /** Underlying transport protocol. */
  protocol: AskableConnectionProtocol;
  /** Number of reconnect attempts since last successful connection. */
  reconnectAttempts: number;
  /** ISO timestamp of when the connection was established, or null if not yet connected. */
  connectedAt: string | null;
  /** ISO timestamp of when the last error or disconnect occurred. */
  disconnectedAt: string | null;
  /** Human-readable error message from the last failure, if any. */
  lastError: string | null;
  /** Optional label for identifying multiple connections (e.g. "chat", "notifications"). */
  label: string | null;
}

export interface AskableCreateConnectionSourceOptions {
  /**
   * Returns the current connection snapshot. Called each time the source is
   * resolved. The framework hook or your integration code manages the state;
   * this getter reads it.
   */
  getSnapshot: () => AskableConnectionSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableConnectionSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "connection". */
  kind?: string;
}

function defaultDescribe(snap: AskableConnectionSourceSnapshot): string {
  const label = snap.label ? `${snap.label} ` : '';
  if (snap.isConnected) return `${label}Connection active (${snap.protocol}).`;
  if (snap.isReconnecting) return `${label}Reconnecting… (attempt ${snap.reconnectAttempts}).${snap.lastError ? ` Last error: ${snap.lastError}` : ''}`;
  if (snap.isConnecting) return `${label}Connecting (${snap.protocol})…`;
  if (snap.status === 'error') return `${label}Connection error.${snap.lastError ? ` ${snap.lastError}` : ''}`;
  return `${label}Disconnected (${snap.protocol}).`;
}

/**
 * Creates a source that exposes WebSocket / SSE / polling connection state to
 * AI assistants so they can explain why real-time features aren't updating,
 * diagnose dropped connections, and guide reconnection.
 *
 * @example
 * ```ts
 * // With socket.io
 * const { setSnapshot } = useAskableConnectionSource({ protocol: 'websocket', label: 'chat' });
 * socket.on('connect', () => setSnapshot({ status: 'connected', ... }));
 * socket.on('disconnect', () => setSnapshot({ status: 'disconnected', ... }));
 * ```
 */
export function createAskableConnectionSource(
  options: AskableCreateConnectionSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'connection',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Connection status unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Connection status unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      if (!snap) return { status: 'unknown', isConnected: false };
      return {
        status: snap.status,
        isConnected: snap.isConnected,
        isReconnecting: snap.isReconnecting,
        reconnectAttempts: snap.reconnectAttempts,
        lastError: snap.lastError,
      };
    },
    data: () => options.getSnapshot(),
  });
}
