import { isWebContextPacket } from '@askable-ui/context';
import type { AskableAgentRequest } from './types.js';

export function isAskableAgentRequest(value: unknown): value is AskableAgentRequest {
  if (!isRecord(value)) return false;
  if (value.requestId !== undefined && typeof value.requestId !== 'string') return false;
  if (typeof value.question !== 'string' || value.question.trim().length === 0) return false;
  if (typeof value.context !== 'string') return false;
  if (!(value.focus === null || isRecord(value.focus))) return false;
  if (value.packet !== undefined && !isWebContextPacket(value.packet)) return false;
  if (value.metadata !== undefined && !isRecord(value.metadata)) return false;
  return typeof value.timestamp === 'number' && Number.isFinite(value.timestamp);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
