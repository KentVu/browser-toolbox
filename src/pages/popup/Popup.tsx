import React from 'react';
import logo from '@assets/img/logo.svg';
import { TabList } from './TabList';
import { Tab } from '../../lib/Tab';

interface PopupProps {
  tabList: Tab[];
}

export default function Popup({ tabList = [] }: PopupProps) {
  return (
    <div className="w-[280px] min-h-[240px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      <div className="mb-2 px-1 text-center">
        <p className="text-sm font-medium tracking-wide text-gray-200">Welcome</p>
      </div>
      <TabList tabList={tabList} />
    </div>
  );
}
