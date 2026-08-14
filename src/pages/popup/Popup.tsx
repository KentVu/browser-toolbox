import React, { useEffect, useState } from 'react';
import logo from '@assets/img/logo.svg';
import { TabList } from './TabList';
import { usePopupStore, type PopupStore as PopupStoreState, type PopupShadow } from './PopupShadow';
import type { Tab } from '@src/lib/Tab';
import { ChromeApi } from '@src/lib/Chrome';

interface PopupProps {
  store: ReturnType<typeof usePopupStore>;
  //store: PopupStoreState;
}

export default function Popup({ store }: PopupProps) {
  return (
    <div className="w-[360px] min-h-[480px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      <div className="mb-2 px-1 text-center">
        <p className="text-sm font-medium tracking-wide text-gray-200">Welcome</p>
      </div>
      <TabList store={store} />
    </div>
  );
}
