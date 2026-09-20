import { isAskableBridgeEnvelope, type AskableBridgeEnvelope } from '@askable-ui/bridge';

const BRIDGE_MESSAGE_TYPE = 'askable:bridge:context';
const GET_LAST_MESSAGE_TYPE = 'askable-companion:get-last';

let lastEnvelope: AskableBridgeEnvelope | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === BRIDGE_MESSAGE_TYPE) {
    if (!isAskableBridgeEnvelope(message.envelope)) {
      sendResponse({ ok: false, error: 'Invalid Askable bridge envelope.' });
      return true;
    }

    const envelope = message.envelope;
    lastEnvelope = envelope;
    sendResponse({
      ok: true,
      requestId: envelope.requestId,
      tabId: sender.tab?.id,
      storedAt: new Date().toISOString(),
    });
    return true;
  }

  if (message?.type === GET_LAST_MESSAGE_TYPE) {
    sendResponse({ ok: true, envelope: lastEnvelope });
    return true;
  }

  return false;
});
