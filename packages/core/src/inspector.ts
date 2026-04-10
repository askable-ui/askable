import type { AskableContext, AskableFocus, AskablePromptContextOptions } from './types.js';

export type AskableInspectorPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface AskableInspectorOptions {
  /**
   * Where to anchor the inspector panel.
   * @default 'bottom-right'
   */
  position?: AskableInspectorPosition;
  /**
   * Serialization options passed to toPromptContext() for the output preview.
   */
  promptOptions?: AskablePromptContextOptions;
  /**
   * Highlight the focused element with an outline.
   * @default true
   */
  highlight?: boolean;
}

export interface AskableInspectorHandle {
  /** Remove the inspector panel from the DOM and detach all listeners. */
  destroy(): void;
}

const PANEL_ID = 'askable-inspector';
const HIGHLIGHT_ATTR = 'data-askable-inspector-highlight';

const POSITION_STYLES: Record<AskableInspectorPosition, string> = {
  'bottom-right': 'bottom:16px;right:16px',
  'bottom-left':  'bottom:16px;left:16px',
  'top-right':    'top:16px;right:16px',
  'top-left':     'top:16px;left:16px',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMeta(meta: Record<string, unknown> | string): string {
  if (typeof meta === 'string') return `<span style="color:#a5d6ff">"${escapeHtml(meta)}"</span>`;
  const lines = Object.entries(meta)
    .map(([k, v]) => `  <span style="color:#79c0ff">${escapeHtml(k)}</span>: <span style="color:#a5d6ff">${escapeHtml(JSON.stringify(v))}</span>`)
    .join(',\n');
  return `{\n${lines}\n}`;
}

function buildPanelHTML(focus: AskableFocus | null, promptContext: string): string {
  if (!focus) {
    return `
      <div style="color:#8b949e;font-style:italic;padding:4px 0">No element focused</div>
    `;
  }

  const elementSection = focus.element
    ? (() => {
        const tag = focus.element.tagName.toLowerCase();
        const id = focus.element.id ? `#${escapeHtml(focus.element.id)}` : '';
        const cls = focus.element.className
          ? `.${String(focus.element.className).trim().split(/\s+/).slice(0, 2).map(escapeHtml).join('.')}`
          : '';
        return `
    <div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Element</span><br>
      <code style="color:#e6edf3">&lt;${escapeHtml(tag)}${id}${cls}&gt;</code>
    </div>`;
      })()
    : `
    <div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Element</span><br>
      <code style="color:#8b949e">(programmatic — no DOM element)</code>
    </div>`;

  return `
    ${elementSection}
    <div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Meta</span><br>
      <pre style="color:#e6edf3;margin:4px 0;white-space:pre-wrap;word-break:break-all">${renderMeta(focus.meta)}</pre>
    </div>
    ${focus.text ? `
    <div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Text</span><br>
      <code style="color:#e6edf3">"${escapeHtml(focus.text.slice(0, 120))}${focus.text.length > 120 ? '…' : ''}"</code>
    </div>
    ` : ''}
    <div>
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Prompt context</span><br>
      <pre style="color:#a5d6ff;margin:4px 0;white-space:pre-wrap;word-break:break-all">${escapeHtml(promptContext)}</pre>
    </div>
  `;
}

/**
 * Mount a floating inspector panel that shows the current Askable focus,
 * parsed metadata, and prompt output in real time.
 *
 * Call `destroy()` on the returned handle to remove it.
 *
 * @example
 * const inspector = createAskableInspector(ctx);
 * // later:
 * inspector.destroy();
 */
export function createAskableInspector(
  ctx: AskableContext,
  options: AskableInspectorOptions = {}
): AskableInspectorHandle {
  if (typeof document === 'undefined') {
    return { destroy: () => {} };
  }

  const { position = 'bottom-right', promptOptions, highlight = true } = options;

  // Remove any existing inspector
  document.getElementById(PANEL_ID)?.remove();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('aria-label', 'Askable inspector');
  panel.style.cssText = [
    'position:fixed',
    POSITION_STYLES[position],
    'z-index:2147483647',
    'width:320px',
    'max-height:420px',
    'overflow:auto',
    'background:#161b22',
    'color:#e6edf3',
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
    'font-size:12px',
    'line-height:1.5',
    'border:1px solid #30363d',
    'border-radius:8px',
    'box-shadow:0 8px 24px rgba(1,4,9,.8)',
    'padding:10px 12px',
  ].join(';');

  // Header row
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #30363d';
  header.innerHTML = `
    <span style="color:#58a6ff;font-weight:700;font-size:11px;letter-spacing:.06em">✦ ASKABLE INSPECTOR</span>
    <button id="askable-inspector-close" style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;padding:2px" title="Close">&times;</button>
  `;
  panel.appendChild(header);

  const body = document.createElement('div');
  panel.appendChild(body);

  document.body.appendChild(panel);

  let highlightedEl: HTMLElement | null = null;

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.removeAttribute(HIGHLIGHT_ATTR);
      highlightedEl.style.removeProperty('outline');
      highlightedEl.style.removeProperty('outline-offset');
      highlightedEl = null;
    }
  }

  function applyHighlight(el: HTMLElement) {
    clearHighlight();
    if (!highlight) return;
    el.setAttribute(HIGHLIGHT_ATTR, '');
    el.style.outline = '2px solid #58a6ff';
    el.style.outlineOffset = '2px';
    highlightedEl = el;
  }

  function update(focus: AskableFocus | null) {
    const promptContext = ctx.toPromptContext(promptOptions);
    body.innerHTML = buildPanelHTML(focus, promptContext);
    if (focus && focus.element?.isConnected) applyHighlight(focus.element);
    else clearHighlight();
  }

  // Initial render
  update(ctx.getFocus());

  const focusHandler = (f: AskableFocus) => update(f);
  const clearHandler = (_: null) => update(null);
  ctx.on('focus', focusHandler);
  ctx.on('clear', clearHandler);

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ctx.off('focus', focusHandler);
    ctx.off('clear', clearHandler);
    clearHighlight();
    panel.remove();
  }

  panel.querySelector('#askable-inspector-close')?.addEventListener('click', destroy);

  return { destroy };
}
