import type {
  AskableAsyncPromptContextOptions,
  AskableContext,
  AskableContextSourceInfo,
  AskableFocus,
  AskableContextSourceInclude,
  AskableContextSourceErrorMode,
  AskableContextSourceMode,
  AskablePromptContextOptions,
} from './types.js';
import { createAskableRegionCapture } from './capture.js';
import { createAskableTextSelectionCapture } from './selection.js';
import type { AskableRegionCaptureHandle, AskableRegionCaptureShape } from './capture.js';
import type { AskableTextSelectionCaptureHandle } from './selection.js';

export type AskableInspectorPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface AskableInspectorSourcePreviewOptions {
  /** Sources to include in the inspector prompt preview. Defaults to all registered sources. */
  sources?: 'all' | AskableContextSourceInclude[];
  /** Default source mode when a source request omits mode. Defaults to "summary". */
  sourceMode?: AskableContextSourceMode;
  /** Heading used in the prompt preview. Defaults to "Context sources". */
  sourceLabel?: string;
  /** How failed sources are shown in the inspector preview. Defaults to "include". */
  sourceErrorMode?: AskableContextSourceErrorMode;
}

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
   * Include resolved app-owned sources in the prompt preview and Copy output.
   * Pass true to include all registered sources with default source options.
   * @default false
   */
  sourcePreview?: boolean | AskableInspectorSourcePreviewOptions;
  /**
   * Highlight the focused element with an outline.
   * @default true
   */
  highlight?: boolean;
  /**
   * Show built-in buttons for testing clear, region, circle, lasso, and text selection modes.
   * @default true
   */
  tools?: boolean;
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

function buildPromptContextHTML(promptContext: string): string {
  return `
    <div>
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Prompt context</span><br>
      <pre style="color:#a5d6ff;margin:4px 0;white-space:pre-wrap;word-break:break-all">${escapeHtml(promptContext)}</pre>
    </div>
  `;
}

function buildFocusHTML(focus: AskableFocus | null, promptContext: string): string {
  if (!focus) {
    return `
      <div style="color:#8b949e;font-style:italic;padding:4px 0">No element focused</div>
      ${buildPromptContextHTML(promptContext)}
    `;
  }
  const el = focus.element;
  const tag = el ? el.tagName.toLowerCase() : null;
  const id = el?.id ? `#${escapeHtml(el.id)}` : '';
  const cls = el?.className
    ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).map(escapeHtml).join('.')}`
    : '';

  return `
    ${tag ? `<div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Element</span><br>
      <code style="color:#e6edf3">&lt;${escapeHtml(tag)}${id}${cls}&gt;</code>
    </div>` : `<div style="margin-bottom:8px">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Source</span><br>
      <code style="color:#e6edf3">${escapeHtml(focus.source)}</code>
    </div>`}
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
    ${buildPromptContextHTML(promptContext)}
  `;
}

function renderTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildSourcesHTML(sources: AskableContextSourceInfo[]): string {
  const rows = sources.length
    ? sources.map((source) => `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #30363d">
        <div style="min-width:0">
          <code style="display:block;color:#e6edf3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(source.id)}</code>
          ${source.kind ? `<span style="color:#8b949e;font-size:11px">${escapeHtml(source.kind)}</span>` : ''}
        </div>
        <span title="Last updated" style="color:#8b949e;font-size:11px;white-space:nowrap">${escapeHtml(renderTime(source.updatedAt))}</span>
      </div>
    `).join('')
    : '<div style="color:#8b949e;font-style:italic;padding-top:4px">No sources registered</div>';

  return `
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #30363d">
      <span style="color:#7ee787;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Context sources</span>
      ${rows}
    </div>
  `;
}

function buildPanelHTML(
  focus: AskableFocus | null,
  promptContext: string,
  sources: AskableContextSourceInfo[],
): string {
  return `${buildFocusHTML(focus, promptContext)}${buildSourcesHTML(sources)}`;
}

function resolveSourcePreviewOptions(
  promptOptions: AskablePromptContextOptions | undefined,
  sourcePreview: true | AskableInspectorSourcePreviewOptions,
): AskableAsyncPromptContextOptions {
  if (sourcePreview === true) {
    return {
      ...promptOptions,
      sources: 'all',
    };
  }

  return {
    ...promptOptions,
    ...sourcePreview,
    sources: sourcePreview.sources ?? 'all',
  };
}

function clampPanelPosition(panel: HTMLElement, left: number, top: number): { left: number; top: number } {
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 8;
  const maxLeft = Math.max(margin, viewportWidth - rect.width - margin);
  const maxTop = Math.max(margin, viewportHeight - rect.height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  };
}

function applyPanelPosition(panel: HTMLElement, left: number, top: number) {
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}

type InspectorToolHandle = Pick<AskableRegionCaptureHandle | AskableTextSelectionCaptureHandle, 'cancel' | 'destroy' | 'isActive'>;

function inspectorButtonStyle(active = false): string {
  return [
    'border:1px solid #30363d',
    `background:${active ? '#1f6feb' : '#21262d'}`,
    `color:${active ? '#ffffff' : '#c9d1d9'}`,
    'border-radius:6px',
    'font:inherit',
    'font-size:11px',
    'line-height:1',
    'padding:6px 7px',
    'cursor:pointer',
  ].join(';');
}

function copyButtonStyle(): string {
  return [
    'border:1px solid #30363d',
    'background:#21262d',
    'color:#c9d1d9',
    'border-radius:6px',
    'font:inherit',
    'font-size:11px',
    'line-height:1',
    'padding:5px 7px',
    'cursor:pointer',
  ].join(';');
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'opacity:0',
  ].join(';');
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
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

  const {
    position = 'bottom-right',
    promptOptions,
    sourcePreview = false,
    highlight = true,
    tools = true,
  } = options;

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
    'max-width:calc(100vw - 32px)',
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
  header.setAttribute('data-askable-inspector-drag-handle', '');
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'margin-bottom:8px',
    'padding-bottom:8px',
    'border-bottom:1px solid #30363d',
    'cursor:grab',
    'user-select:none',
  ].join(';');
  header.innerHTML = `
    <span style="color:#58a6ff;font-weight:700;font-size:11px;letter-spacing:.06em">✦ ASKABLE INSPECTOR</span>
    <span style="display:flex;align-items:center;gap:6px">
      <button id="askable-inspector-copy" data-askable-inspector-copy style="${copyButtonStyle()}" title="Copy prompt context">Copy</button>
      <button id="askable-inspector-close" style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;padding:2px" title="Close">&times;</button>
    </span>
  `;
  panel.appendChild(header);

  const toolsEl = document.createElement('div');
  toolsEl.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'gap:6px',
    'margin-bottom:8px',
    'padding-bottom:8px',
    'border-bottom:1px solid #30363d',
  ].join(';');
  if (tools) panel.appendChild(toolsEl);

  const body = document.createElement('div');
  panel.appendChild(body);

  document.body.appendChild(panel);

  let destroyed = false;
  let highlightedEl: HTMLElement | null = null;
  let latestPromptContext = '';
  let updateVersion = 0;

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

  function renderFocusState(focus: AskableFocus | null, promptContext: string) {
    latestPromptContext = promptContext;
    body.innerHTML = buildPanelHTML(focus, promptContext, ctx.listSources());
    if (focus?.element?.isConnected) applyHighlight(focus.element);
    else clearHighlight();
  }

  async function updateSourcePreview(focus: AskableFocus | null, version: number) {
    if (!sourcePreview) return;
    try {
      const promptContext = await ctx.toPromptContextAsync(
        resolveSourcePreviewOptions(promptOptions, sourcePreview),
      );
      if (destroyed || version !== updateVersion) return;
      renderFocusState(focus, promptContext);
    } catch {
      if (destroyed || version !== updateVersion) return;
      const fallback = `${ctx.toPromptContext(promptOptions)}\n\nContext sources:\nContext source unavailable.`;
      renderFocusState(focus, fallback);
    }
  }

  function update(focus: AskableFocus | null) {
    const version = ++updateVersion;
    const promptContext = ctx.toPromptContext(promptOptions);
    renderFocusState(focus, promptContext);
    if (sourcePreview) void updateSourcePreview(focus, version);
  }

  // Initial render
  update(ctx.getFocus());

  const focusHandler = (f: AskableFocus) => update(f);
  const clearHandler = (_: null) => update(null);
  const sourceHandler = () => update(ctx.getFocus());
  ctx.on('focus', focusHandler);
  ctx.on('clear', clearHandler);
  ctx.on('sourcechange', sourceHandler);

  let activeTool: InspectorToolHandle | null = null;
  let activeToolName: string | null = null;
  let dragging: {
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null = null;

  function stopActiveTool() {
    activeTool?.destroy();
    activeTool = null;
    activeToolName = null;
    renderTools();
  }

  function toolCaptureMeta(mode: string, meta: Record<string, unknown>) {
    ctx.push({ capture: mode, ...meta }, `${mode} inspector selection`);
  }

  function startRegionTool(shape: AskableRegionCaptureShape) {
    stopActiveTool();
    const handle = createAskableRegionCapture(ctx, {
      shape,
      intent: `inspect ${shape} selection`,
      onCapture: (packet, selection) => {
        activeTool = null;
        activeToolName = null;
        toolCaptureMeta(packet.capture.mode, {
          shape: selection.shape,
          bounds: selection.bounds,
          ...(selection.points ? { pointCount: selection.points.length } : {}),
        });
        renderTools();
      },
      onCancel: () => {
        activeTool = null;
        activeToolName = null;
        renderTools();
      },
    });
    activeTool = handle;
    activeToolName = shape;
    handle.start();
    renderTools();
  }

  function startTextSelectionTool() {
    stopActiveTool();
    const handle = createAskableTextSelectionCapture(ctx, {
      once: true,
      intent: 'inspect text selection',
      onCapture: (_packet, selection) => {
        activeTool = null;
        activeToolName = null;
        ctx.push({
          capture: 'text-selection',
          length: selection.text.length,
          ...(selection.bounds ? { bounds: selection.bounds } : {}),
          ...(selection.selector ? { selector: selection.selector } : {}),
        }, selection.text);
        renderTools();
      },
      onCancel: () => {
        activeTool = null;
        activeToolName = null;
        renderTools();
      },
    });
    activeTool = handle;
    activeToolName = 'text';
    handle.start();
    renderTools();
  }

  function renderTools() {
    if (!tools) return;
    const buttons = [
      { id: 'region', label: 'Region', onClick: () => startRegionTool('region') },
      { id: 'circle', label: 'Circle', onClick: () => startRegionTool('circle') },
      { id: 'lasso', label: 'Lasso', onClick: () => startRegionTool('lasso') },
      { id: 'text', label: 'Text', onClick: () => startTextSelectionTool() },
      { id: 'clear', label: 'Clear', onClick: () => { stopActiveTool(); ctx.clear(); } },
    ];
    toolsEl.replaceChildren(...buttons.map((button) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('data-askable-inspector-tool', button.id);
      el.style.cssText = inspectorButtonStyle(activeToolName === button.id);
      el.textContent = button.label;
      el.addEventListener('click', button.onClick);
      return el;
    }));
  }

  function onDragMove(event: MouseEvent) {
    if (!dragging) return;
    event.preventDefault();
    const next = clampPanelPosition(
      panel,
      dragging.startLeft + event.clientX - dragging.startX,
      dragging.startTop + event.clientY - dragging.startY,
    );
    applyPanelPosition(panel, next.left, next.top);
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = null;
    header.style.cursor = 'grab';
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  function onDragStart(event: MouseEvent) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const start = clampPanelPosition(panel, rect.left, rect.top);
    applyPanelPosition(panel, start.left, start.top);
    dragging = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: start.left,
      startTop: start.top,
    };
    header.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    ctx.off('focus', focusHandler);
    ctx.off('clear', clearHandler);
    ctx.off('sourcechange', sourceHandler);
    onDragEnd();
    stopActiveTool();
    header.removeEventListener('mousedown', onDragStart);
    clearHighlight();
    panel.remove();
  }

  renderTools();
  header.addEventListener('mousedown', onDragStart);
  panel.querySelector('#askable-inspector-close')?.addEventListener('click', destroy);
  panel.querySelector('#askable-inspector-copy')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) return;
    try {
      await copyText(latestPromptContext);
      button.textContent = 'Copied';
      window.setTimeout(() => {
        if (!destroyed) button.textContent = 'Copy';
      }, 1200);
    } catch {
      button.textContent = 'Failed';
      window.setTimeout(() => {
        if (!destroyed) button.textContent = 'Copy';
      }, 1200);
    }
  });

  return { destroy };
}
