import React from 'react';
import { TabList } from './TabList';
import { PopupPresenter } from './PopupPresenter';

interface PopupProps {
  presenter: PopupPresenter;
}

export default function Popup({ presenter }: PopupProps) {
  return (
    <div className="w-[360px] min-h-[480px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      <div className="mb-2 px-1 text-center">
        <p className="text-sm font-medium tracking-wide text-gray-200">Welcome</p>
      </div>
      <TabList presenter={presenter} />
    </div>
  );
}
