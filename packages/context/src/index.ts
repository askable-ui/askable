export const WEB_CONTEXT_PROTOCOL = 'askable.context';
export const WEB_CONTEXT_VERSION = '0.1';

export type WebContextJson =
  | string
  | number
  | boolean
  | null
  | WebContextJson[]
  | { [key: string]: WebContextJson };

export type WebContextRecord = Record<string, unknown>;

export type WebContextCaptureMode =
  | 'text-selection'
  | 'element-focus'
  | 'viewport'
  | 'full-page'
  | 'region'
  | 'lasso'
  | 'circle'
  | 'semantic'
  | 'custom';

export type WebContextGesture =
  | 'click'
  | 'hover'
  | 'focus'
  | 'keyboard'
  | 'drag'
  | 'circle'
  | 'lasso'
  | 'programmatic'
  | 'custom';

export type WebContextProvenanceMethod =
  | 'app'
  | 'dom'
  | 'extension'
  | 'mcp'
  | 'manual';

export interface WebContextSource {
  url?: string;
  title?: string;
  app?: string;
  route?: string;
  timestamp: string;
}

export interface WebContextCapture {
  mode: WebContextCaptureMode;
  gesture?: WebContextGesture;
  intent?: string;
}

export interface WebContextRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WebContextScreenshot {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  data?: string;
  url?: string;
}

export interface WebContextTarget {
  text?: string;
  role?: string;
  label?: string;
  selector?: string;
  bounds?: WebContextRect;
  metadata?: WebContextRecord | string;
  screenshot?: WebContextScreenshot;
}

export interface WebContextSurrounding {
  ancestors?: WebContextTarget[];
  nearby?: WebContextTarget[];
  visible?: WebContextTarget[];
  history?: WebContextTarget[];
  sources?: WebContextTarget[];
}

export interface WebContextPrivacy {
  redacted: boolean;
  consent: 'explicit' | 'implicit' | 'none';
  omitted?: string[];
}

export interface WebContextProvenance {
  producer: string;
  method: WebContextProvenanceMethod;
}

export interface WebContextPacket {
  protocol: typeof WEB_CONTEXT_PROTOCOL;
  version: typeof WEB_CONTEXT_VERSION;
  source: WebContextSource;
  capture: WebContextCapture;
  target?: WebContextTarget;
  surrounding?: WebContextSurrounding;
  privacy: WebContextPrivacy;
  provenance: WebContextProvenance;
}

export interface CreateWebContextPacketOptions {
  source?: Partial<WebContextSource>;
  capture: WebContextCapture;
  target?: WebContextTarget;
  surrounding?: WebContextSurrounding;
  privacy?: Partial<WebContextPrivacy>;
  provenance?: Partial<WebContextProvenance>;
}

export const webContextPacketSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://askable-ui.com/schemas/context-packet-0.1.schema.json',
  title: 'Context Packet',
  type: 'object',
  required: ['protocol', 'version', 'source', 'capture', 'privacy', 'provenance'],
  additionalProperties: false,
  properties: {
    protocol: { const: WEB_CONTEXT_PROTOCOL },
    version: { const: WEB_CONTEXT_VERSION },
    source: {
      type: 'object',
      required: ['timestamp'],
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        title: { type: 'string' },
        app: { type: 'string' },
        route: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
    capture: {
      type: 'object',
      required: ['mode'],
      additionalProperties: false,
      properties: {
        mode: {
          enum: [
            'text-selection',
            'element-focus',
            'viewport',
            'full-page',
            'region',
            'lasso',
            'circle',
            'semantic',
            'custom',
          ],
        },
        gesture: {
          enum: [
            'click',
            'hover',
            'focus',
            'keyboard',
            'drag',
            'circle',
            'lasso',
            'programmatic',
            'custom',
          ],
        },
        intent: { type: 'string' },
      },
    },
    target: { $ref: '#/$defs/target' },
    surrounding: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ancestors: { type: 'array', items: { $ref: '#/$defs/target' } },
        nearby: { type: 'array', items: { $ref: '#/$defs/target' } },
        visible: { type: 'array', items: { $ref: '#/$defs/target' } },
        history: { type: 'array', items: { $ref: '#/$defs/target' } },
        sources: { type: 'array', items: { $ref: '#/$defs/target' } },
      },
    },
    privacy: {
      type: 'object',
      required: ['redacted', 'consent'],
      additionalProperties: false,
      properties: {
        redacted: { type: 'boolean' },
        consent: { enum: ['explicit', 'implicit', 'none'] },
        omitted: { type: 'array', items: { type: 'string' } },
      },
    },
    provenance: {
      type: 'object',
      required: ['producer', 'method'],
      additionalProperties: false,
      properties: {
        producer: { type: 'string' },
        method: { enum: ['app', 'dom', 'extension', 'mcp', 'manual'] },
      },
    },
  },
  $defs: {
    rect: {
      type: 'object',
      required: ['x', 'y', 'width', 'height'],
      additionalProperties: false,
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
    },
    screenshot: {
      type: 'object',
      required: ['mimeType'],
      additionalProperties: false,
      properties: {
        mimeType: { enum: ['image/png', 'image/jpeg', 'image/webp'] },
        data: { type: 'string' },
        url: { type: 'string' },
      },
    },
    target: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string' },
        role: { type: 'string' },
        label: { type: 'string' },
        selector: { type: 'string' },
        bounds: { $ref: '#/$defs/rect' },
        metadata: {
          oneOf: [
            { type: 'string' },
            { type: 'object', additionalProperties: true },
          ],
        },
        screenshot: { $ref: '#/$defs/screenshot' },
      },
    },
  },
} as const;

export function createWebContextPacket(options: CreateWebContextPacketOptions): WebContextPacket {
  return {
    protocol: WEB_CONTEXT_PROTOCOL,
    version: WEB_CONTEXT_VERSION,
    source: {
      timestamp: new Date().toISOString(),
      ...options.source,
    },
    capture: options.capture,
    ...(options.target ? { target: options.target } : {}),
    ...(options.surrounding ? { surrounding: options.surrounding } : {}),
    privacy: {
      redacted: false,
      consent: 'implicit',
      ...options.privacy,
    },
    provenance: {
      producer: 'askable-ui',
      method: 'app',
      ...options.provenance,
    },
  };
}

// Enum sets are read straight from the schema so the runtime guard and the
// published JSON Schema can never drift apart.
const captureModeValues = webContextPacketSchema.properties.capture.properties.mode.enum;
const captureGestureValues = webContextPacketSchema.properties.capture.properties.gesture.enum;
const privacyConsentValues = webContextPacketSchema.properties.privacy.properties.consent.enum;
const provenanceMethodValues = webContextPacketSchema.properties.provenance.properties.method.enum;

function isEnumMember(allowed: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

export function isWebContextPacket(value: unknown): value is WebContextPacket {
  if (!isRecord(value)) return false;
  if (value.protocol !== WEB_CONTEXT_PROTOCOL || value.version !== WEB_CONTEXT_VERSION) return false;
  if (!isRecord(value.source) || typeof value.source.timestamp !== 'string') return false;
  if (!isRecord(value.capture) || !isEnumMember(captureModeValues, value.capture.mode)) return false;
  if (value.capture.gesture !== undefined && !isEnumMember(captureGestureValues, value.capture.gesture)) return false;
  if (!isRecord(value.privacy) || typeof value.privacy.redacted !== 'boolean') return false;
  if (!isEnumMember(privacyConsentValues, value.privacy.consent)) return false;
  if (!isRecord(value.provenance) || typeof value.provenance.producer !== 'string') return false;
  return isEnumMember(provenanceMethodValues, value.provenance.method);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
