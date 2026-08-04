import Chrome from '@src/lib/Chrome';
import { Tab } from '@src/lib/Tab';
import { PopupShadow } from './PopupShadow';

export class DefaultPopupShadow extends PopupShadow {
  constructor(private readonly tabs: Tab[]) {
    super();
  }

  async tabList(): Promise<Tab[]> {
    const tabList: Tab[] = await Chrome.tabs.get();
    return tabList;
  }
}
