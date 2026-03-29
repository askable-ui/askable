// @askable-ui/core v0.1.1 — bundled single file

var EVENT_MAP = { click: 'click', hover: 'mouseenter', focus: 'focus' };
var ALL_EVENTS = ['click', 'hover', 'focus'];

function parseMeta(raw) { try { return JSON.parse(raw); } catch { return raw; } }
function extractText(el) { var t = (el.textContent || '').trim(); return t.length > 200 ? t.slice(0,200) : t; }
function buildFocus(el) {
  var raw = el.getAttribute('data-askable');
  if (!raw) return null;
  return { meta: parseMeta(raw), text: extractText(el), element: el, timestamp: Date.now() };
}

function Observer(onFocus) {
  this.root = null;
  this.mutationObserver = null;
  this.boundElements = [];
  this.activeEvents = ALL_EVENTS;
  this.onFocus = onFocus;
  var self = this;
  this.handler = function(e) {
    var focus = buildFocus(e.currentTarget);
    if (focus) self.onFocus(focus);
  };
}
Observer.prototype.observe = function(root, events) {
  if (this.root) this.unobserve();
  this.root = root;
  this.activeEvents = events || ALL_EVENTS;
  var self = this;
  var rootEl = root === document ? document.documentElement : root;
  rootEl.querySelectorAll('[data-askable]').forEach(function(el) { self.attach(el); });
  this.mutationObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (!(n instanceof HTMLElement)) return;
        if (n.hasAttribute('data-askable')) self.attach(n);
        n.querySelectorAll('[data-askable]').forEach(function(el) { self.attach(el); });
      });
      m.removedNodes.forEach(function(n) {
        if (n instanceof HTMLElement) self.detach(n);
      });
    });
  });
  this.mutationObserver.observe(root, { childList: true, subtree: true });
};
Observer.prototype.unobserve = function() {
  if (this.mutationObserver) { this.mutationObserver.disconnect(); this.mutationObserver = null; }
  var self = this;
  this.boundElements.forEach(function(el) { self.detach(el); });
  this.boundElements = [];
  this.root = null;
};
Observer.prototype.attach = function(el) {
  if (this.boundElements.indexOf(el) !== -1) return;
  var self = this;
  this.activeEvents.forEach(function(e) { el.addEventListener(EVENT_MAP[e], self.handler); });
  this.boundElements.push(el);
};
Observer.prototype.detach = function(el) {
  var self = this;
  this.activeEvents.forEach(function(e) { el.removeEventListener(EVENT_MAP[e], self.handler); });
};

function Emitter() { this.handlers = {}; }
Emitter.prototype.on = function(ev, fn) { if (!this.handlers[ev]) this.handlers[ev] = []; this.handlers[ev].push(fn); };
Emitter.prototype.off = function(ev, fn) { if (this.handlers[ev]) this.handlers[ev] = this.handlers[ev].filter(function(h) { return h !== fn; }); };
Emitter.prototype.emit = function(ev, payload) { (this.handlers[ev] || []).forEach(function(h) { h(payload); }); };
Emitter.prototype.clear = function() { this.handlers = {}; };

function AskableContextImpl() {
  var self = this;
  this.currentFocus = null;
  this.emitter = new Emitter();
  this.observer = new Observer(function(focus) {
    self.currentFocus = focus;
    self.emitter.emit('focus', focus);
  });
}
AskableContextImpl.prototype.observe = function(root, options) {
  this.observer.observe(root, options && options.events);
};
AskableContextImpl.prototype.unobserve = function() { this.observer.unobserve(); };
AskableContextImpl.prototype.getFocus = function() { return this.currentFocus; };
AskableContextImpl.prototype.on = function(ev, fn) { this.emitter.on(ev, fn); };
AskableContextImpl.prototype.off = function(ev, fn) { this.emitter.off(ev, fn); };
AskableContextImpl.prototype.toPromptContext = function() {
  var focus = this.currentFocus;
  if (!focus) return 'No UI element is currently focused.';
  var meta = focus.meta;
  var metaStr = typeof meta === 'string' ? meta :
    Object.keys(meta).map(function(k) { return k + ': ' + meta[k]; }).join(', ');
  var parts = ['User is focused on:'];
  if (metaStr) parts.push(metaStr);
  if (focus.text) parts.push('value "' + focus.text + '"');
  return parts.join(' — ');
};
AskableContextImpl.prototype.destroy = function() {
  this.observer.unobserve();
  this.emitter.clear();
  this.currentFocus = null;
};

window.createAskableContext = function() { return new AskableContextImpl(); };
