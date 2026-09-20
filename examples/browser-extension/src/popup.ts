import './popup.css';

type CaptureMode = 'selected' | 'focus' | 'page';

interface CaptureResponse {
  ok: boolean;
  error?: string;
  prompt?: string;
  packet?: unknown;
  acks?: unknown;
}

const statusEl = document.querySelector<HTMLElement>('#status')!;
const questionEl = document.querySelector<HTMLTextAreaElement>('#question')!;
const promptEl = document.querySelector<HTMLTextAreaElement>('#prompt')!;
const packetEl = document.querySelector<HTMLPreElement>('#packet')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy')!;
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'));

for (const button of buttons) {
  button.addEventListener('click', () => {
    void capture(button.dataset.mode as CaptureMode);
  });
}

copyButton.addEventListener('click', async () => {
  if (!promptEl.value) return;
  await navigator.clipboard.writeText(promptEl.value);
  setStatus('Copied prompt context.');
});

async function capture(mode: CaptureMode): Promise<void> {
  setBusy(mode);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab is available.');

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'askable-companion:capture',
      mode,
      question: questionEl.value.trim() || undefined,
    }) as CaptureResponse;

    if (!response?.ok) {
      throw new Error(response?.error ?? 'The page did not return Askable context.');
    }

    promptEl.value = response.prompt ?? '';
    packetEl.textContent = JSON.stringify({
      packet: response.packet,
      acks: response.acks,
    }, null, 2);
    copyButton.disabled = !promptEl.value;
    setStatus(`Captured ${labelFor(mode)} context.`);
  } catch (error) {
    promptEl.value = '';
    packetEl.textContent = '{}';
    copyButton.disabled = true;
    setStatus(error instanceof Error ? error.message : 'Capture failed.');
  } finally {
    setIdle();
  }
}

function setBusy(mode: CaptureMode): void {
  setStatus(`Capturing ${labelFor(mode)} context...`);
  for (const button of buttons) button.disabled = true;
}

function setIdle(): void {
  for (const button of buttons) button.disabled = false;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function labelFor(mode: CaptureMode): string {
  if (mode === 'selected') return 'selected text';
  if (mode === 'page') return 'full page';
  return 'focused element';
}
