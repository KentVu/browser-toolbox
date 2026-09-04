import React from 'react';
import { TabList } from './TabList';
import { PopupShadow } from './PopupShadow';

interface PopupProps {
  shadow: PopupShadow;
}

export default function Popup({ shadow }: PopupProps) {
  return (
    <div className="w-[360px] min-h-[480px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      <div className="mb-2 px-1 text-center">
        <p className="text-sm font-medium tracking-wide text-gray-200">Welcome</p>
      </div>
      <TabList shadow={shadow} />
    </div>
  );
}
