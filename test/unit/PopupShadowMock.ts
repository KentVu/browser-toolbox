import { shortcutKeys } from '@src/lib/constants';
import type { Tab } from '@src/lib/Tab';
import { PopupShadow } from '@src/pages/popup/PopupShadow';

export class PopupShadowMock extends PopupShadow {
  private readonly tabs: Tab[];

  constructor(tabList: Tab[] = []) {
    super();
    this.tabs = tabList;
  }

  async tabList(): Promise<Tab[]> {
    return this.tabs;
  }
}
