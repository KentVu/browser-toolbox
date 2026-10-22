import { GET_VIM_MODE_STATE_MESSAGE, TOGGLE_VIM_MODE_MESSAGE } from '@src/lib/VimMode';
import { VimMode } from './VimMode';

const vimMode = new VimMode(document);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object'
    && message !== null
    && 'type' in message
  ) {
    if (message.type === TOGGLE_VIM_MODE_MESSAGE) {
      sendResponse(vimMode.toggle());
    } else if (message.type === GET_VIM_MODE_STATE_MESSAGE) {
      sendResponse(vimMode.isActive());
    }
  }
});
