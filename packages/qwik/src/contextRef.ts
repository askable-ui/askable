import type { NoSerialize, Signal } from '@builder.io/qwik';
import type { AskableContext } from '@askable-ui/core';

export type AskableContextRef = Signal<NoSerialize<AskableContext> | undefined>;

export function getAskableContext(ctxRef: AskableContextRef): AskableContext {
  const ctx = ctxRef.value;
  if (!ctx) throw new Error('Askable context is not available before the Qwik visible task runs');
  return ctx;
}
