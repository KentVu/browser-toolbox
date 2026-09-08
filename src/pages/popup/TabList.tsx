import React, { useEffect, useRef } from 'react';
import { Tab } from '@src/lib/Tab';
import { PopupShadow } from './PopupShadow';

interface TabListProps {
    shadow: PopupShadow;
}

const keyLabelClass = 'rounded border border-cyan-400/60 bg-cyan-400/10 px-1 font-mono font-semibold text-cyan-200';

function getSplitViewLabels(tabList: Tab[]): Map<number, number> {
    const splitViewIds = [...new Set(
        tabList
            .map(tab => tab.splitViewId)
            .filter((splitViewId): splitViewId is number => splitViewId !== undefined && splitViewId !== -1),
    )].sort((a, b) => a - b);
    return new Map(splitViewIds.map((splitViewId, index) => [splitViewId, index + 1]));
}

function getWindowLabels(tabList: Tab[]): Map<number, number> {
    const windowIds = [...new Set(
        tabList
            .map(tab => tab.windowId)
            .filter((windowId): windowId is number => windowId !== undefined),
    )].sort((a, b) => a - b);
    return new Map(windowIds.map((windowId, index) => [windowId, index + 1]));
}

function TabList({ shadow }: TabListProps) {
    const [tabList, keyMap] = shadow.useVisibleTabList();
    const splitViewLabels = getSplitViewLabels(tabList);
    const windowLabels = getWindowLabels(tabList);
    const selectedTabId = shadow.useSelectedTabId();
    const currentWindowId = shadow.useCurrentWindowId();
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
                    const splitViewLabel = tab.splitViewId === undefined || tab.splitViewId === -1
                        ? undefined
                        : splitViewLabels.get(tab.splitViewId);
                    const differentWindow = currentWindowId !== undefined && tab.windowId !== currentWindowId;
                    const windowLabel = tab.windowId === undefined ? undefined : windowLabels.get(tab.windowId);
                    const isSelected = tab.id === selectedTabId;
                    return (
                        <li
                            key={tab.id}
                            onClick={() => shadow.setState({ selectedTabId: tab.id })}
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
                                    <kbd className={`${keyLabelClass} text-[9px] tracking-tight shrink-0`}>
                                        {shortcut}
                                    </kbd>
                                </div>
                                {(hostname || splitViewLabel !== undefined) && (
                                    <div className="text-[9px] text-gray-500 truncate leading-none mt-px">
                                        {hostname && <span>{hostname}</span>}
                                        {differentWindow && windowLabel !== undefined && (
                                            <span className="ml-1" aria-label={`Window ${windowLabel}`}>
                                                &#129695;{windowLabel}
                                            </span>
                                        )}
                                        {splitViewLabel !== undefined && (
                                            <span className="ml-1" aria-label={`Split view ${splitViewLabel}`}>
                                                &#128279;{splitViewLabel}
                                            </span>
                                        )}
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
                    Page {pageIndex + 1}/{pageCount} · <kbd className={keyLabelClass}>,</kbd> first/prev · <kbd className={keyLabelClass}>.</kbd> last/next
                </div>
            )}
            <div className="text-[10px] text-gray-500 px-1 py-1">
                {selectedTabId === undefined ?
                    "Press a key to select a tab" :
                    <>
                        <div>Select next action:</div>
                        <ul className="list-disc list-inside text-[9px] text-gray-500">
                            <li><kbd className={keyLabelClass}>j</kbd>/<kbd className={keyLabelClass}>k</kbd> or <kbd className={keyLabelClass}>↑</kbd>/<kbd className={keyLabelClass}>↓</kbd>: Move selection down/up (pages at edges)</li>
                            <li><kbd className={keyLabelClass}>]</kbd>: Move tab to the right of current tab</li>
                            <li><kbd className={keyLabelClass}>[</kbd>: Move tab to the left of current tab</li>
                            <li><kbd className={keyLabelClass}>Enter</kbd>: Activate tab</li>
                        </ul>
                    </>
                }
            </div>
        </div>
    );
};

export { TabList, TabListProps };