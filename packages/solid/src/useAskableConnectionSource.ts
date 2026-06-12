import { createSignal } from 'solid-js';
import { createAskableConnectionSource } from '@askable-ui/core';
import type {
  AskableCreateConnectionSourceOptions,
  AskableConnectionStatus,
  AskableConnectionProtocol,
  AskableConnectionSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSourceOptions, type UseAskableSourceResult } from './useAskableSource.js';

export type { AskableConnectionStatus, AskableConnectionProtocol, AskableConnectionSourceSnapshot };

export interface UseAskableConnectionSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateConnectionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "connection". */
  id?: string;
  /** Underlying transport protocol. @default "websocket" */
  protocol?: AskableConnectionProtocol;
  /** Optional label to identify this connection (e.g. "chat", "notifications"). */
  label?: string;
  /** Initial status. @default "disconnected" */
  initialStatus?: AskableConnectionStatus;
}

export interface UseAskableConnectionSourceResult extends UseAskableSourceResult {
  snapshot: () => AskableConnectionSourceSnapshot | null;
  setStatus: (
    status: AskableConnectionStatus,
    extra?: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>>,
  ) => void;
}

/**
 * SolidJS primitive that exposes WebSocket / SSE / polling connection state to
 * AI assistants so they can explain why real-time features aren't updating.
 *
 * @example
 * ```tsx
 * const { setStatus } = useAskableConnectionSource({ protocol: 'websocket', label: 'chat' });
 * socket.on('connect', () => setStatus('connected'));
 * socket.on('disconnect', () => setStatus('disconnected'));
 * ```
 */
export function useAskableConnectionSource(
  options: UseAskableConnectionSourceOptions = {},
): UseAskableConnectionSourceResult {
  const {
    id = 'connection',
    protocol = 'websocket',
    label = null,
    initialStatus = 'disconnected',
    describe,
    kind,
    enabled,
    ctx,
    name,
    events,
  } = options;

  const [snapshot, setSnapshot] = createSignal<AskableConnectionSourceSnapshot | null>({
    status: initialStatus,
    isConnected: initialStatus === 'connected',
    isConnecting: initialStatus === 'connecting',
    isReconnecting: initialStatus === 'reconnecting',
    protocol,
    reconnectAttempts: 0,
    connectedAt: null,
    disconnectedAt: null,
    lastError: null,
    label,
  });

  const source = createAskableConnectionSource({
    describe,
    kind,
    getSnapshot: snapshot,
  });

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  function setStatus(
    status: AskableConnectionStatus,
    extra: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>> = {},
  ): void {
    const now = new Date().toISOString();
    setSnapshot((prev) => ({
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting',
      isReconnecting: status === 'reconnecting',
      protocol: prev?.protocol ?? protocol,
      reconnectAttempts: extra.reconnectAttempts ?? (status === 'connected' ? 0 : (prev?.reconnectAttempts ?? 0)),
      connectedAt: status === 'connected' ? now : (prev?.connectedAt ?? null),
      disconnectedAt: status === 'disconnected' || status === 'error' ? now : (prev?.disconnectedAt ?? null),
      lastError: extra.lastError ?? (status === 'connected' ? null : (prev?.lastError ?? null)),
      label: prev?.label ?? label,
    }));
    result.notifyChanged();
  }

  return { ...result, snapshot, setStatus };
}
