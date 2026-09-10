import React from 'react';
import { createRoot } from 'react-dom/client';
import '@pages/popup/index.css';
import '@assets/styles/tailwind.css';
import Popup from '@pages/popup/Popup';
import { PopupPresenter } from './PopupPresenter';
import { Browser } from '@src/lib/Browser';
import { Chrome } from '@src/lib/Chrome';

async function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Popup root element");
  const root = createRoot(rootContainer);
  const presenter = new PopupPresenter(Chrome, Browser);

  root.render(<Popup presenter={presenter} />);
}

init();
