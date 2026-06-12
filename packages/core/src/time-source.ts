import type { AskableContextSource } from './types.js';
import { createAskableSource } from './sources.js';

export interface AskableTimeSourceSnapshot {
  /** Current ISO 8601 timestamp. */
  now: string;
  /** IANA timezone name (e.g. "America/New_York"). */
  timezone: string;
  /** UTC offset in minutes (e.g. -300 for UTC-5). */
  utcOffsetMinutes: number;
  /** Human-readable UTC offset string (e.g. "UTC-5:00"). */
  utcOffsetLabel: string;
  /** Current day of week (0=Sunday … 6=Saturday). */
  dayOfWeek: number;
  /** Current hour in local time (0-23). */
  hour: number;
  /** Current minute (0-59). */
  minute: number;
  /** Whether the current time falls within business hours (09:00–17:00 Mon–Fri by default). */
  isBusinessHours: boolean;
  /** Whether it is currently a weekend (Saturday or Sunday). */
  isWeekend: boolean;
  /** Seconds elapsed since the page was first loaded. */
  sessionSeconds: number;
}

export interface AskableBusinessHoursConfig {
  /** Start hour in local time (0-23). @default 9 */
  startHour?: number;
  /** End hour in local time (0-23). @default 17 */
  endHour?: number;
  /** Working days (0=Sunday … 6=Saturday). @default [1,2,3,4,5] */
  workDays?: number[];
}

export interface AskableCreateTimeSourceOptions {
  /**
   * Returns the current time snapshot. Called on each resolve.
   * Framework hooks manage interval-based updates; this getter reads the result.
   */
  getSnapshot: () => AskableTimeSourceSnapshot | null;
  /** Human-readable description. */
  describe?: string | ((snapshot: AskableTimeSourceSnapshot) => string | Promise<string>);
  /** Source category. Defaults to "time". */
  kind?: string;
}

export function buildTimeSnapshot(
  businessHours: AskableBusinessHoursConfig = {},
  sessionStartMs: number,
): AskableTimeSourceSnapshot {
  const { startHour = 9, endHour = 17, workDays = [1, 2, 3, 4, 5] } = businessHours;

  const now = new Date();
  const offsetMinutes = -now.getTimezoneOffset();
  const absOffset = Math.abs(offsetMinutes);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetH = Math.floor(absOffset / 60);
  const offsetM = absOffset % 60;
  const utcOffsetLabel = `UTC${sign}${offsetH}:${offsetM.toString().padStart(2, '0')}`;

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // SSR or unsupported
  }

  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isBusinessHours = workDays.includes(dayOfWeek) && hour >= startHour && hour < endHour;
  const sessionSeconds = Math.floor((Date.now() - sessionStartMs) / 1000);

  return {
    now: now.toISOString(),
    timezone,
    utcOffsetMinutes: offsetMinutes,
    utcOffsetLabel,
    dayOfWeek,
    hour,
    minute,
    isBusinessHours,
    isWeekend,
    sessionSeconds,
  };
}

function defaultDescribe(snap: AskableTimeSourceSnapshot): string {
  const parts: string[] = [];

  const timeStr = `${snap.hour.toString().padStart(2, '0')}:${snap.minute.toString().padStart(2, '0')}`;
  parts.push(`Current time: ${timeStr} (${snap.utcOffsetLabel}, ${snap.timezone})`);

  if (snap.isWeekend) {
    parts.push('It is the weekend.');
  } else if (snap.isBusinessHours) {
    parts.push('Within business hours.');
  } else {
    parts.push('Outside business hours.');
  }

  const sessionMins = Math.floor(snap.sessionSeconds / 60);
  if (sessionMins > 0) {
    parts.push(`Session duration: ${sessionMins} min.`);
  }

  return parts.join(' ');
}

/**
 * Creates a time context source that exposes the current local time, timezone,
 * business hours status, and session duration to AI assistants.
 *
 * @example
 * ```ts
 * // AI: "It's 5:45pm on a Friday — just outside business hours.
 * //      You've been working on this form for 22 minutes."
 * ```
 */
export function createAskableTimeSource(
  options: AskableCreateTimeSourceOptions,
): AskableContextSource {
  return createAskableSource({
    kind: options.kind ?? 'time',
    describe: options.describe
      ? async () => {
          const snap = options.getSnapshot();
          if (!snap) return 'Time unavailable.';
          const d = options.describe!;
          return typeof d === 'function' ? d(snap) : d;
        }
      : async () => {
          const snap = options.getSnapshot();
          return snap ? defaultDescribe(snap) : 'Time unavailable.';
        },
    state: () => {
      const snap = options.getSnapshot();
      return {
        timezone: snap?.timezone ?? 'UTC',
        isBusinessHours: snap?.isBusinessHours ?? false,
        isWeekend: snap?.isWeekend ?? false,
        sessionSeconds: snap?.sessionSeconds ?? 0,
      };
    },
    data: () => options.getSnapshot(),
  });
}
