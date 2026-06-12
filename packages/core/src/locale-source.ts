import { createAskableSource } from './sources.js';
import type { AskableContextSource } from './types.js';

export interface AskableLocaleSourceSnapshot {
  /** BCP 47 language tag (e.g. "en-US", "fr-FR", "zh-CN"). */
  locale: string;
  /** Primary language code (e.g. "en", "fr", "zh"). */
  language: string;
  /** Region code, if present (e.g. "US", "FR", "CN"). */
  region: string | null;
  /** IANA timezone string (e.g. "America/New_York"). */
  timezone: string;
  /** UTC offset string (e.g. "+05:30", "-08:00"). */
  utcOffset: string;
  /** Current time in the user's timezone (ISO 8601). */
  currentTime: string;
  /** Hour cycle: "h12" (12-hour) or "h23" (24-hour). */
  hourCycle: 'h12' | 'h23' | 'h11' | 'h24' | null;
  /** Currency code inferred from locale (e.g. "USD", "EUR"). */
  currency: string | null;
  /** Date format order: "dmy", "mdy", or "ymd". */
  dateOrder: 'dmy' | 'mdy' | 'ymd' | null;
  /** Whether the locale uses right-to-left text direction. */
  isRTL: boolean;
  /** Calendar system (e.g. "gregory", "islamic", "hebrew"). */
  calendar: string | null;
}

export interface AskableCreateLocaleSourceOptions {
  /**
   * Override the locale. Defaults to `navigator.language`.
   */
  locale?: string;
  /**
   * Override the timezone. Defaults to the system timezone.
   */
  timezone?: string;
  /** Custom describe function. */
  describe?: (snapshot: AskableLocaleSourceSnapshot) => string;
  /** Source category. Defaults to "locale". */
  kind?: string;
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ku', 'dv', 'ps', 'sd', 'ug']);

const CURRENCY_BY_REGION: Record<string, string> = {
  US: 'USD', GB: 'GBP', EU: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
  JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', BR: 'BRL', CA: 'CAD', AU: 'AUD',
  CH: 'CHF', MX: 'MXN', RU: 'RUB', SG: 'SGD', HK: 'HKD', NZ: 'NZD', SE: 'SEK',
  NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', TR: 'TRY', ZA: 'ZAR',
  NG: 'NGN', EG: 'EGP', PH: 'PHP', TH: 'THB', ID: 'IDR', MY: 'MYR', VN: 'VND',
  AR: 'ARS', CL: 'CLP', CO: 'COP', PK: 'PKR', BD: 'BDT', UA: 'UAH', RO: 'RON',
};

function getUtcOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).format(now);
    const match = formatted.match(/GMT([+-]\d{1,2}(?::\d{2})?)/);
    if (match) return match[1].startsWith('+') || match[1].startsWith('-') ? match[1] : `+${match[1]}`;
    return '+00:00';
  } catch {
    return '+00:00';
  }
}

function getHourCycle(locale: string, timezone: string): 'h12' | 'h23' | 'h11' | 'h24' | null {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: timezone });
    return (fmt.resolvedOptions().hourCycle ?? null) as ReturnType<typeof getHourCycle>;
  } catch {
    return null;
  }
}

function getDateOrder(locale: string, timezone: string): 'dmy' | 'mdy' | 'ymd' | null {
  try {
    const date = new Date(2013, 0, 2); // Jan 2, 2013 — unambiguous
    const parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone,
    }).formatToParts(date);
    const order = parts
      .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
      .map((p) => p.type[0]);
    const key = order.join('');
    if (key === 'dmy' || key === 'mdy' || key === 'ymd') return key as 'dmy' | 'mdy' | 'ymd';
    return null;
  } catch {
    return null;
  }
}

function getCalendar(locale: string): string | null {
  try {
    const resolved = new Intl.DateTimeFormat(locale).resolvedOptions();
    return resolved.calendar ?? null;
  } catch {
    return null;
  }
}

function buildSnapshot(options: AskableCreateLocaleSourceOptions): AskableLocaleSourceSnapshot {
  const locale = options.locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const parts = locale.split('-');
  const language = parts[0].toLowerCase();
  const region = parts[1]?.toUpperCase() ?? null;

  return {
    locale,
    language,
    region,
    timezone,
    utcOffset: getUtcOffset(timezone),
    currentTime: new Date().toISOString(),
    hourCycle: getHourCycle(locale, timezone),
    currency: region ? (CURRENCY_BY_REGION[region] ?? null) : null,
    dateOrder: getDateOrder(locale, timezone),
    isRTL: RTL_LANGUAGES.has(language),
    calendar: getCalendar(locale),
  };
}

function defaultDescribe(snapshot: AskableLocaleSourceSnapshot): string {
  const lines: string[] = [];

  lines.push(`Locale: ${snapshot.locale} (${snapshot.language}${snapshot.region ? `-${snapshot.region}` : ''})`);
  lines.push(`Timezone: ${snapshot.timezone} (UTC${snapshot.utcOffset})`);
  lines.push(`Current time: ${snapshot.currentTime}`);

  if (snapshot.hourCycle) {
    lines.push(`Time format: ${snapshot.hourCycle === 'h12' || snapshot.hourCycle === 'h11' ? '12-hour' : '24-hour'}`);
  }
  if (snapshot.dateOrder) {
    lines.push(`Date order: ${snapshot.dateOrder.toUpperCase()} (e.g. ${snapshot.dateOrder === 'mdy' ? 'MM/DD/YYYY' : snapshot.dateOrder === 'dmy' ? 'DD/MM/YYYY' : 'YYYY/MM/DD'})`);
  }
  if (snapshot.currency) lines.push(`Currency: ${snapshot.currency}`);
  if (snapshot.isRTL) lines.push('Text direction: right-to-left');

  return lines.join('\n');
}

/**
 * Creates a locale/timezone context source that exposes the user's language,
 * region, timezone, date format order, currency, and hour cycle — so AI assistants
 * can correctly format dates, times, and currencies for the user's locale.
 *
 * @example
 * ```ts
 * const source = createAskableLocaleSource();
 * ctx.registerSource('locale', source);
 *
 * // AI now knows the user's timezone and can say "It's 3pm in New York"
 * ```
 */
export function createAskableLocaleSource(
  options: AskableCreateLocaleSourceOptions = {},
): AskableContextSource {
  const { describe, kind = 'locale' } = options;

  return createAskableSource({
    kind,
    describe: describe
      ? () => describe(buildSnapshot(options))
      : () => defaultDescribe(buildSnapshot(options)),
    state: () => {
      const s = buildSnapshot(options);
      return {
        locale: s.locale,
        timezone: s.timezone,
        language: s.language,
      };
    },
    data: () => buildSnapshot(options),
  });
}
