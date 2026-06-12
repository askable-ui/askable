import { useCallback, useMemo, useRef, useState } from 'react';
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
  /** Current connection snapshot (reflects latest setStatus() call). */
  snapshot: AskableConnectionSourceSnapshot | null;
  /**
   * Update the connection status. Call this from your WebSocket/SSE event
   * handlers to keep AI assistants informed.
   *
   * @example
   * socket.on('connect', () => setStatus('connected'));
   * socket.on('disconnect', () => setStatus('disconnected'));
   * socket.on('reconnecting', (n) => setStatus('reconnecting', { reconnectAttempts: n }));
   */
  setStatus: (
    status: AskableConnectionStatus,
    extra?: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>>,
  ) => void;
}

/**
 * React hook that exposes WebSocket / SSE / polling connection state to AI
 * assistants so they can explain why real-time features aren't updating and
 * guide reconnection.
 *
 * @example
 * ```tsx
 * const { setStatus } = useAskableConnectionSource({ protocol: 'websocket', label: 'chat' });
 *
 * useEffect(() => {
 *   socket.on('connect', () => setStatus('connected'));
 *   socket.on('disconnect', () => setStatus('disconnected'));
 *   socket.on('reconnecting', (n) => setStatus('reconnecting', { reconnectAttempts: n }));
 *   return () => socket.off('connect').off('disconnect').off('reconnecting');
 * }, []);
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

  const [snapshot, setSnapshot] = useState<AskableConnectionSourceSnapshot | null>(() => ({
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
  }));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const source = useMemo(
    () =>
      createAskableConnectionSource({
        describe,
        kind,
        getSnapshot: () => snapshotRef.current,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const result = useAskableSource(id, source, { enabled, ctx, name, events });

  const notifyRef = useRef(result.notifyChanged);
  notifyRef.current = result.notifyChanged;

  const setStatus = useCallback(
    (
      status: AskableConnectionStatus,
      extra: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>> = {},
    ) => {
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
      notifyRef.current();
    },
    [protocol, label],
  );

  return { ...result, snapshot, setStatus };
}
