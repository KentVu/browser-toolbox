import React, { useEffect, useState } from 'react';
import logo from '@assets/img/logo.svg';
import { TabList } from './TabList';
import type { PopupShadow } from './PopupShadow';
import type { Tab } from '@src/lib/Tab';

interface PopupProps {
  shadow: PopupShadow;
}

export default function Popup({ shadow }: PopupProps) {
  const [tabList, setTabList] = useState<Tab[]>([]);
  const [keyMap, setKeyMap] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadTabs() {
      const tabs = await shadow.tabList();
      if (cancelled) return;
      setTabList(tabs);
      setKeyMap(shadow.tabKeyMap(tabs.map(tab => tab.id)));
    }

    loadTabs();
    return () => {
      cancelled = true;
    };
  }, [shadow]);

  return (
    <div className="w-[360px] min-h-[480px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      <div className="mb-2 px-1 text-center">
        <p className="text-sm font-medium tracking-wide text-gray-200">Welcome</p>
      </div>
      <TabList tabList={tabList} keyMap={keyMap} />
    </div>
  );
}
