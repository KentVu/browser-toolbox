import React, { useState, useEffect, useRef } from 'react';
import { Tab } from '@src/lib/Tab';
import { shortcutKeys } from '@src/lib/constants';

interface TabListProps {
    tabList: Tab[];
}

function TabList({ tabList }: TabListProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        listRef.current?.focus();
    }, []);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const idx = shortcutKeys.indexOf(e.key.toLowerCase());
            if (idx !== -1 && idx < tabList.length) {
                setSelectedIndex(idx);
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [tabList.length]);

    return (
        <div className="w-full mt-2">
            <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider mb-1 px-1">TAB LIST</h2>
            <ul
                ref={listRef}
                tabIndex={-1}
                className="divide-y divide-gray-700 bg-gray-800/80 rounded-md border border-gray-700 text-left max-h-[360px] overflow-auto shadow-inner focus:outline-none"
            >
                {tabList.map((tab: Tab, index: number) => {
                    let hostname = '';
                    if (tab.url) {
                        try { hostname = new URL(tab.url).hostname; } catch {}
                    }
                    const shortcut = shortcutKeys[index] || String((index % 26) + 1);
                    const isSelected = index === selectedIndex;
                    return (
                        <li
                            key={tab.id}
                            className={`px-2.5 py-1.5 flex items-center gap-2 hover:bg-gray-700/70 cursor-pointer transition-colors group ${isSelected ? 'selected' : ''}`}
                        >
                            <div className="w-3.5 h-3.5 rounded-sm bg-gradient-to-br from-gray-500 to-gray-600 flex-shrink-0 ring-1 ring-gray-600/50" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                    <div className="text-xs text-gray-100 truncate flex-1 group-hover:text-blue-300 transition-colors">
                                        {tab.title || 'Untitled'}
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500/70 tracking-tight shrink-0">
                                        {shortcut}
                                    </span>
                                </div>
                                {hostname && (
                                    <div className="text-[9px] text-gray-500 truncate leading-none mt-px">
                                        {hostname}
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {tabList.length === 0 && (
                <div className="text-[10px] text-gray-500 px-1 py-1">No open tabs</div>
            )}
            <div className="text-[10px] text-gray-500 px-1 py-1">{
                selectedIndex === null ?
                    "Select a tab" :
                    <>
                        <div>Select next action:</div>
                        <ul className="list-disc list-inside text-[9px] text-gray-500">
                            <li><span>{']'}</span>: Move tab to the right of current tab</li>
                            <li><span>{'['}</span>: Move tab to the left of current tab</li>
                            <li><span>{'Enter'}</span>: Activate tab</li>
                        </ul>
                    </>
            }</div>
        </div>
    );
};

export { TabList, TabListProps };