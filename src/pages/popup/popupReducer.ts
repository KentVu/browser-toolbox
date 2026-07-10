import { useReducer } from 'react';
import { useImmerReducer } from 'use-immer';
import { produce } from 'immer';
import DefaultChrome, { ChromeApi } from '@src/lib/Chrome';
import { Tab } from '@src/lib/Tab';
import { a } from 'node_modules/vitest/dist/chunks/suite.d.udJtyAgw';

export interface PopupState {
  mode: 'top' | 'tabControl';
  tabs: Tab[] | null;
  //selectedTabId: number | null;
}

interface PopupAction {
  type: 'MOVE_TABCONTROL';
  payload: { tabId: number } | { };
}

export class PopupReducer {
  private Chrome: ChromeApi;
  constructor(Chrome: ChromeApi = DefaultChrome) {
    this.Chrome = Chrome;
  }

  reduce = async function(draft: PopupState, action: PopupAction) {
    switch (action.type) {
      case 'MOVE_TABCONTROL':
        draft.mode = 'tabControl';
        draft.tabs = await this.Chrome.tabs.getByLastAccessed();
        break;
      default:
        break;
    }
  };
}

export const usePopupReducer = () => {
  const [state, dispatch] = useReducer(new PopupReducer().reduce, { mode: 'top', tabs: [] as any[] | null });

  return { state, dispatch };
};
