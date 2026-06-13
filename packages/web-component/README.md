# @askable-ui/web-component

A framework-neutral `<askable-context>` custom element for HTMX, Ember,
server-rendered HTML, and vanilla JavaScript.

```bash
npm install @askable-ui/web-component @askable-ui/core
```

## Usage

Import the package once to register the element:

```html
<script type="module">
  import '@askable-ui/web-component';
</script>

<askable-context id="dashboard">
  <article data-askable='{"metric":"revenue","value":"$2.34M"}'>
    Revenue: $2.34M
  </article>
</askable-context>
```

Listen for approved context changes:

```js
const dashboard = document.querySelector('#dashboard');

dashboard.addEventListener('askable:focus', (event) => {
  sendToAssistant(event.detail.promptContext);
});
```

Use `defineAskableContext('my-context')` to register a custom tag name. The
module is safe to import during server rendering; registration occurs only in a
browser with `customElements`.

## Element API

| Surface | Purpose |
| --- | --- |
| `scope` attribute | Limit observation to a named Askable scope |
| `observe="false"` | Disable automatic DOM observation |
| `askableContext` | Access the underlying `AskableContext` |
| `promptContext` | Read current prompt-ready context |
| `currentFocus` | Read current structured focus |
| `askable:focus` | Receive focus and prompt context changes |
| `askable:clear` | Receive context clear events |

## Links

- [Documentation](https://askable-ui.com/docs/)
- [GitHub](https://github.com/askable-ui/askable)
- [npm](https://www.npmjs.com/package/@askable-ui/web-component)
