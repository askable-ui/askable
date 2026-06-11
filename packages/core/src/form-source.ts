import type {
  AskableContextSource,
  AskableContextSourceResolveRequest,
} from './types.js';

export interface AskableFormFieldSnapshot {
  name: string;
  type: string;
  label?: string;
  value?: string | boolean | string[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface AskableFormSourceSnapshot {
  fields: AskableFormFieldSnapshot[];
  hasErrors: boolean;
  errorCount: number;
  errorFields?: string[];
}

export interface AskableCreateFormSourceOptions {
  /** The form element or a selector string to locate the form. */
  form?: HTMLFormElement | string | (() => HTMLFormElement | null | undefined);
  /** Human-readable source description. Defaults to "Active form". */
  describe?: string | (() => string | Promise<string>);
  /** Source category. Defaults to "form". */
  kind?: string;
  /** Field names to omit from resolved snapshots. Useful for sensitive fields. */
  omitFields?: string[];
  /** When true, password fields have their value replaced with "***". Defaults to true. */
  maskPasswords?: boolean;
  /** Override how a field's label text is resolved. */
  resolveLabel?: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => string | undefined;
  /** Override value reading for a field. Return undefined to use default. */
  resolveValue?: (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => string | boolean | string[] | undefined;
  /** Redact or transform the resolved snapshot. */
  sanitizeSnapshot?: (snapshot: AskableFormSourceSnapshot) => AskableFormSourceSnapshot;
}

/**
 * Creates a source that reads HTML form state — field names, values, types,
 * labels, HTML5 validation errors, and required/disabled states — so an AI
 * assistant can provide contextual help, suggest corrections, and guide users
 * through complex forms.
 *
 * Passwords are masked by default. Use `omitFields` to exclude sensitive fields.
 *
 * @example
 * ```tsx
 * const formSource = createAskableFormSource({ form: formRef.current });
 * ctx.registerSource('checkout-form', formSource);
 * ```
 */
export function createAskableFormSource(
  options: AskableCreateFormSourceOptions = {},
): AskableContextSource {
  return {
    kind: options.kind ?? 'form',
    modes: ['state', 'summary', 'all'],
    describe: options.describe ?? 'Active form',
    getState: () => {
      const form = resolveForm(options.form);
      if (!form) return undefined;
      const elements = getFormElements(form);
      const errorFields = elements
        .filter((el) => !el.validity.valid)
        .map((el) => el.name)
        .filter(Boolean);
      return {
        fieldCount: elements.length,
        hasErrors: errorFields.length > 0,
        errorCount: errorFields.length,
      };
    },
    resolve: (request) => resolveFormSnapshot(request, options),
  };
}

function resolveFormSnapshot(
  request: AskableContextSourceResolveRequest,
  options: AskableCreateFormSourceOptions,
): AskableFormSourceSnapshot | undefined {
  const form = resolveForm(options.form);
  if (!form) return undefined;

  const elements = getFormElements(form);
  const omit = new Set(options.omitFields ?? []);
  const maskPasswords = options.maskPasswords !== false;

  const fields: AskableFormFieldSnapshot[] = [];
  for (const el of elements) {
    if (!el.name) continue;
    if (omit.has(el.name)) continue;

    const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : el.tagName.toLowerCase();
    const field: AskableFormFieldSnapshot = {
      name: el.name,
      type,
      label: resolveLabel(el, options),
      required: el.required || undefined,
      disabled: el.disabled || undefined,
    };

    if (el instanceof HTMLInputElement && el.placeholder) {
      field.placeholder = el.placeholder;
    }

    const validationMessage = el.validationMessage?.trim();
    if (validationMessage) {
      field.error = validationMessage;
    }

    if (request.mode === 'all') {
      const isPassword = type === 'password';
      if (isPassword && maskPasswords) {
        field.value = el.value ? '***' : '';
      } else {
        field.value = options.resolveValue?.(el) ?? readFieldValue(el);
      }
    }

    // Remove undefined values to keep the snapshot compact
    if (field.label === undefined) delete field.label;
    if (field.placeholder === undefined) delete field.placeholder;
    if (field.required === undefined) delete field.required;
    if (field.disabled === undefined) delete field.disabled;
    if (field.error === undefined) delete field.error;
    if (field.value === undefined) delete field.value;

    fields.push(field);
  }

  const errorFields = fields.filter((f) => f.error).map((f) => f.name);
  const snapshot: AskableFormSourceSnapshot = {
    fields,
    hasErrors: errorFields.length > 0,
    errorCount: errorFields.length,
    ...(errorFields.length > 0 ? { errorFields } : {}),
  };

  return options.sanitizeSnapshot ? options.sanitizeSnapshot(snapshot) : snapshot;
}

function resolveForm(
  form: AskableCreateFormSourceOptions['form'],
): HTMLFormElement | null {
  if (!form) {
    return typeof document === 'undefined' ? null : document.querySelector('form');
  }
  if (typeof form === 'string') {
    return typeof document === 'undefined' ? null : document.querySelector<HTMLFormElement>(form);
  }
  if (typeof form === 'function') {
    return form() ?? null;
  }
  return form;
}

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function getFormElements(form: HTMLFormElement): FormElement[] {
  return Array.from(form.elements).filter(
    (el): el is FormElement =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement,
  );
}

function resolveLabel(
  el: FormElement,
  options: AskableCreateFormSourceOptions,
): string | undefined {
  if (options.resolveLabel) {
    const custom = options.resolveLabel(el);
    if (custom !== undefined) return custom;
  }

  const doc = el.ownerDocument;
  const id = el.id;
  if (id) {
    const label = doc.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  const closest = el.closest('label');
  if (closest) {
    const clone = closest.cloneNode(true) as HTMLLabelElement;
    const input = clone.querySelector('input,select,textarea');
    input?.remove();
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  return undefined;
}

function readFieldValue(el: FormElement): string | boolean | string[] {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    if (el.type === 'file') return el.files ? Array.from(el.files).map((f) => f.name) : [];
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    if (el.multiple) {
      return Array.from(el.selectedOptions).map((opt) => opt.value);
    }
    return el.value;
  }
  return el.value;
}
