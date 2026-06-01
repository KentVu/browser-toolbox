import React from 'react';
import logo from '@assets/img/logo.svg';
import { Tab, TabList } from './TabList';

interface PopupProps {
  tabList: Tab[];
}

export default function Popup({ tabList = [] }: PopupProps) {
  return (
    <div className="absolute top-0 left-0 right-0 bottom-0 text-center h-full p-3 bg-gray-800">
      <header className="flex flex-col items-center justify-center text-white">
        <p>Welcome</p>
        <TabList tabList={tabList} />
        <p>Popup styled with TailwindCSS!</p>
      </header>
    </div>
  );
}
