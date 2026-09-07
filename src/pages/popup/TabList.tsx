import React, { useEffect, useRef } from 'react';
import { Tab } from '@src/lib/Tab';
import { PopupShadow } from './PopupShadow';

interface TabListProps {
    shadow: PopupShadow;
}

function TabList({ shadow }: TabListProps) {
    const [tabList, keyMap] = shadow.useVisibleTabList();
    const selectedTabId = shadow.useSelectedTabId();
    const { pageIndex, pageCount } = shadow.usePageInfo();
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        //listRef.current?.focus();
        void shadow.fetchTabList();
    }, [shadow]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const pressed = e.key.toLowerCase();
            shadow.onKeyPress(pressed);
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shadow]);

    return (
        <div className="w-full mt-2">
            <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider mb-1 px-1">TAB LIST</h2>
            <ul
                ref={listRef}
                tabIndex={-1}
                className="divide-y divide-gray-700 bg-gray-80/80 rounded-md border border-gray-700 text-left shadow-inner focus:outline-none"
            >
                {tabList.map((tab: Tab, index: number) => {
                    let hostname = '';
                    if (tab.url) {
                        try { hostname = new URL(tab.url).hostname; } catch {}
                    }
                    const shortcut = keyMap.get(tab.id) || String((index % 26) + 1);
                    const isSelected = tab.id === selectedTabId;
                    return (
                        <li
                            key={tab.id}
                            className={`px-2.5 py-1.5 flex items-center gap-2 hover:bg-gray-700/70 cursor-pointer transition-colors group ${isSelected ? 'selected' : ''}`}
                        >
                            {tab.icon ? (
                                <img
                                    src={tab.icon}
                                    alt=""
                                    className="w-3.5 h-3.5 rounded-sm object-cover flex-shrink-0 ring-1 ring-gray-600/50"
                                />
                            ) : (
                                <div className="w-3.5 h-3.5 rounded-sm bg-gradient-to-br from-gray-500 to-gray-600 flex-shrink-0 ring-1 ring-gray-600/50" />
                            )}
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
            {pageCount > 1 && (
                <div className="text-[10px] text-gray-500 px-1 py-1">
                    Page {pageIndex + 1}/{pageCount} · <span>,</span> prev · <span>.</span> next
                </div>
            )}
            <div className="text-[10px] text-gray-500 px-1 py-1">
                {selectedTabId === undefined ?
                    "Press a key to select a tab" :
                    <>
                        <div>Select next action:</div>
                        <ul className="list-disc list-inside text-[9px] text-gray-500">
                            <li><span>{'j'}</span>/<span>{'k'}</span>: Move selection down/up</li>
                            <li><span>{']'}</span>: Move tab to the right of current tab</li>
                            <li><span>{'['}</span>: Move tab to the left of current tab</li>
                            <li><span>{'Enter'}</span>: Activate tab</li>
                        </ul>
                    </>
                }
            </div>
        </div>
    );
};

export { TabList, TabListProps };