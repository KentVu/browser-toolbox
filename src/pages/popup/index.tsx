import React from 'react';
import { createRoot } from 'react-dom/client';
import '@pages/popup/index.css';
import '@assets/styles/tailwind.css';
import Popup from '@pages/popup/Popup';
import { Tab } from '@lib/Tab';
import Chrome from '@lib/Chrome';

async function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Popup root element");
  const root = createRoot(rootContainer);

  const tabList: Tab[] = await Chrome.tabs.get();

  root.render(<Popup tabList={tabList} />);
}

init();
