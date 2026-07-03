import React from 'react';
import { Tab } from '@src/lib/Tab';

interface TabListProps {
    tabList: Tab[];
}

function TabList({ tabList }: TabListProps) {
    return (
        <div className="w-full mt-2">
            <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider mb-1 px-1">TAB LIST</h2>
            <ul className="divide-y divide-gray-700 bg-gray-800/80 rounded-md border border-gray-700 text-left max-h-[120px] overflow-auto shadow-inner">
                {tabList.map((tab: Tab) => {
                    let hostname = '';
                    if (tab.url) {
                        try { hostname = new URL(tab.url).hostname; } catch {}
                    }
                    return (
                        <li
                            key={tab.id}
                            className="px-2.5 py-1.5 flex items-center gap-2 hover:bg-gray-700/70 active:bg-gray-600 cursor-pointer transition-colors group"
                        >
                            <div className="w-3.5 h-3.5 rounded-sm bg-gradient-to-br from-gray-500 to-gray-600 flex-shrink-0 ring-1 ring-gray-600/50" />
                            <div className="min-w-0 flex-1">
                                <div className="text-xs text-gray-100 truncate group-hover:text-blue-300 transition-colors">
                                    {tab.title || 'Untitled'}
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
        </div>
    );
};

export { TabList, TabListProps };