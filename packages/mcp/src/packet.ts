import { webContextPacketSchema, type WebContextPacket } from '@askable-ui/context';
import { z } from 'zod';

// Use the published schema, including nested fields, without duplicating its rules.
const packetSchema = z.fromJSONSchema(
  webContextPacketSchema as unknown as z.core.JSONSchema.JSONSchema,
);

export function parseContextPacket(value: unknown): WebContextPacket {
  const result = packetSchema.safeParse(value);
  if (!result.success) {
    // Validation details can contain app-owned field names or values.
    throw new Error('Invalid Context packet: response does not match the Context packet schema.');
  }
  // Preserve the validated packet's identity and JSON field order for callers.
  return value as WebContextPacket;
}
