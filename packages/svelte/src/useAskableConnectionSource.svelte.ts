import { createAskableConnectionSource } from '@askable-ui/core';
import type {
  AskableContext,
  AskableCreateConnectionSourceOptions,
  AskableConnectionStatus,
  AskableConnectionProtocol,
  AskableConnectionSourceSnapshot,
} from '@askable-ui/core';
import { useAskableSource, type UseAskableSource, type UseAskableSourceOptions } from './useAskableSource.svelte.js';

export type { AskableConnectionStatus, AskableConnectionProtocol, AskableConnectionSourceSnapshot };

export interface UseAskableConnectionSourceOptions
  extends UseAskableSourceOptions,
    Omit<AskableCreateConnectionSourceOptions, 'getSnapshot'> {
  /** Source registration id. Defaults to "connection". */
  id?: string;
  /** Provide an existing context instead of creating a new one. */
  ctx?: AskableContext;
  /** Underlying transport protocol. @default "websocket" */
  protocol?: AskableConnectionProtocol;
  /** Optional label to identify this connection (e.g. "chat", "notifications"). */
  label?: string;
  /** Initial status. @default "disconnected" */
  initialStatus?: AskableConnectionStatus;
}

export interface UseAskableConnectionSource extends UseAskableSource {
  setStatus: (
    status: AskableConnectionStatus,
    extra?: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>>,
  ) => void;
  readonly snapshot: AskableConnectionSourceSnapshot | null;
}

/**
 * Svelte 5 runes-based composable that exposes WebSocket / SSE / polling
 * connection state to AI assistants so they can explain why real-time features
 * aren't updating.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAskableConnectionSource } from '@askable-ui/svelte/useAskableConnectionSource.svelte';
 *   const { setStatus } = useAskableConnectionSource({ protocol: 'websocket', label: 'chat' });
 *   socket.on('connect', () => setStatus('connected'));
 *   socket.on('disconnect', () => setStatus('disconnected'));
 * </script>
 * ```
 */
export function useAskableConnectionSource(
  options: UseAskableConnectionSourceOptions = {},
): UseAskableConnectionSource {
  const {
    id = 'connection',
    protocol = 'websocket',
    label = null,
    initialStatus = 'disconnected',
    ctx,
    describe,
    kind,
    observe,
    enabled,
    ...ctxOptions
  } = options;

  let snapshot = $state<AskableConnectionSourceSnapshot | null>({
    status: initialStatus,
    isConnected: initialStatus === 'connected',
    isConnecting: initialStatus === 'connecting',
    isReconnecting: initialStatus === 'reconnecting',
    protocol,
    reconnectAttempts: 0,
    connectedAt: null,
    disconnectedAt: null,
    lastError: null,
    label: label ?? null,
  });

  const connectionSource = createAskableConnectionSource({
    describe,
    kind,
    getSnapshot: () => snapshot,
  });

  const result = useAskableSource(id, {
    ...connectionSource,
    ...ctxOptions,
    ctx,
    observe,
    enabled,
  });

  function setStatus(
    status: AskableConnectionStatus,
    extra: Partial<Pick<AskableConnectionSourceSnapshot, 'reconnectAttempts' | 'lastError'>> = {},
  ): void {
    const now = new Date().toISOString();
    const prev = snapshot;
    snapshot = {
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting',
      isReconnecting: status === 'reconnecting',
      protocol: prev?.protocol ?? protocol,
      reconnectAttempts: extra.reconnectAttempts ?? (status === 'connected' ? 0 : (prev?.reconnectAttempts ?? 0)),
      connectedAt: status === 'connected' ? now : (prev?.connectedAt ?? null),
      disconnectedAt: status === 'disconnected' || status === 'error' ? now : (prev?.disconnectedAt ?? null),
      lastError: extra.lastError ?? (status === 'connected' ? null : (prev?.lastError ?? null)),
      label: prev?.label ?? label ?? null,
    };
    result.notifyChanged();
  }

  return {
    ...result,
    setStatus,
    get snapshot() { return snapshot; },
  };
}
