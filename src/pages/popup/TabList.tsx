import { useEffect, useRef } from 'preact/hooks';
import { Tab } from '@src/lib/Tab';
import { hostnameOf, urlWithoutFragment } from '@src/lib/Util';
import { pageCount as countPages, PopupPresenter, visibleTabs } from './PopupPresenter';

interface TabListProps {
    presenter: PopupPresenter;
}

const keyLabelClass = 'rounded border border-cyan-400/60 bg-cyan-400/10 px-1 font-mono font-semibold text-cyan-200';

type TabBadges = {
    current?: true;
    windowLabel?: number;
    splitViewLabel?: number;
    duplicateLabel?: number;
};

const INDICATOR_LEGEND = [
    { key: 'current', icon: '\u{25CF}', label: 'current', ariaPrefix: 'Current tab' },
    { key: 'windowLabel', icon: '\u{1FA9F}', label: 'other window', ariaPrefix: 'Window' },
    { key: 'splitViewLabel', icon: '\u{1F517}', label: 'split view', ariaPrefix: 'Split view' },
    { key: 'duplicateLabel', icon: '\u{29C9}', label: 'duplicate', ariaPrefix: 'Duplicate' },
] as const;

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

/** Labels duplicated tabs (same URL up to fragment) by creation order; older tab id first. */
function getDuplicateLabels(tabList: Tab[]): Map<number, number> {
    const byUrl = new Map<string, Tab[]>();
    for (const tab of tabList) {
        if (!tab.url) {
            continue;
        }
        const key = urlWithoutFragment(tab.url);
        if (!key) {
            continue;
        }
        const group = byUrl.get(key);
        if (group) {
            group.push(tab);
        } else {
            byUrl.set(key, [tab]);
        }
    }

    const labels = new Map<number, number>();
    for (const group of byUrl.values()) {
        if (group.length < 2) {
            continue;
        }
        [...group]
            .sort((a, b) => a.id - b.id)
            .forEach((tab, index) => {
                labels.set(tab.id, index + 1);
            });
    }
    return labels;
}

function getTabBadges(
    tab: Tab,
    currentTabId: number | undefined,
    currentWindowId: number | undefined,
    windowLabels: Map<number, number>,
    splitViewLabels: Map<number, number>,
    duplicateLabels: Map<number, number>,
): TabBadges {
    const differentWindow = currentWindowId !== undefined
        && tab.windowId !== undefined
        && tab.windowId !== currentWindowId;
    return {
        current: tab.id === currentTabId ? true : undefined,
        windowLabel: differentWindow ? windowLabels.get(tab.windowId!) : undefined,
        splitViewLabel: tab.splitViewId === undefined || tab.splitViewId === -1
            ? undefined
            : splitViewLabels.get(tab.splitViewId),
        duplicateLabel: duplicateLabels.get(tab.id),
    };
}

function formatIndicator(
    ariaPrefix: string,
    icon: string,
    value: number | true,
): { label: string; text: string } {
    if (value === true) {
        return { label: ariaPrefix, text: icon };
    }
    return { label: `${ariaPrefix} ${value}`, text: `${icon}${value}` };
}

function getLegendItems(badgesList: TabBadges[]) {
    return INDICATOR_LEGEND
        .filter(({ key }) => badgesList.some(badges => badges[key] !== undefined))
        .map(({ icon, label }) => ({ icon, label }));
}

function renderHighlightedText(text: string, searchQuery: string | undefined): React.ReactNode {
    if (!searchQuery) {
        return text;
    }
    const index = text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) {
        return text;
    }
    return (
        <>
            {text.slice(0, index)}
            <mark>{text.slice(index, index + searchQuery.length)}</mark>
            {text.slice(index + searchQuery.length)}
        </>
    );
}

function TabList({ presenter }: TabListProps) {
    const {
        tabList: allTabs,
        tabKeyMap: keyMap,
        selectedTabId,
        currentTabId,
        currentWindowId,
        errorMessage,
        searchQuery,
        lastSearchQuery,
        highlightQuery,
        showHelp,
        pageIndex,
    } = presenter.usePopupState();
    const tabList = visibleTabs(allTabs, pageIndex);
    const pageCount = countPages(allTabs);
    const splitViewLabels = getSplitViewLabels(tabList);
    const windowLabels = getWindowLabels(tabList);
    const duplicateLabels = getDuplicateLabels(allTabs);
    const listRef = useRef<HTMLUListElement>(null);
    const moveBesideActiveDisabled = selectedTabId !== undefined && selectedTabId === currentTabId;
    const inactiveKeyLabelClass = 'rounded border border-gray-600 bg-gray-800/60 px-1 font-mono font-semibold text-gray-500';
    const tabBadges = tabList.map(tab => getTabBadges(
        tab,
        currentTabId,
        currentWindowId,
        windowLabels,
        splitViewLabels,
        duplicateLabels,
    ));
    const legendItems = getLegendItems(tabBadges);

    useEffect(() => {
        //listRef.current?.focus();
        void presenter.ensureTabListLoaded();
    }, [presenter]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const pressed = e.key.toLowerCase();
            const key = e.ctrlKey ? `ctrl+${pressed}` : e.shiftKey ? e.key : pressed;
            const { showHelp, searchQuery } = presenter.s();
            if (pressed === 'escape' && (showHelp || searchQuery !== undefined)) {
                e.preventDefault();
            }
            if (key === 'ctrl+w' || key === 'ctrl+c' || key === 'ctrl+v' || key === 'ctrl+backspace') {
                e.preventDefault();
            }
            void presenter.onKeyPress(key);
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [presenter]);

    return (
        <div className="w-full mt-2">
            <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider mb-1 px-1">TAB LIST</h2>
            <ul
                ref={listRef}
                tabIndex={-1}
                className="divide-y divide-gray-700 bg-gray-80/80 rounded-md border border-gray-700 text-left shadow-inner focus:outline-none"
            >
                {tabList.map((tab: Tab, index: number) => {
                    const hostname = hostnameOf(tab.url);
                    const shortcut = keyMap.get(tab.id) || String((index % 26) + 1);
                    const badges = tabBadges[index];
                    const hasBadges = INDICATOR_LEGEND.some(({ key }) => badges[key] !== undefined);
                    const isSelected = tab.id === selectedTabId;
                    const isCurrent = tab.id === currentTabId;
                    const activeQuery = isSelected ? (searchQuery ?? highlightQuery) : undefined;
                    return (
                        <li
                            key={tab.id}
                            onClick={() => presenter.setState({ selectedTabId: tab.id })}
                            aria-current={isCurrent ? 'true' : undefined}
                            className={`px-2.5 py-1.5 flex items-center gap-2 hover:bg-gray-700/70 cursor-pointer transition-colors group ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
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
                                        {renderHighlightedText(
                                            tab.title || 'Untitled',
                                            activeQuery,
                                        )}
                                    </div>
                                    <kbd className={`${keyLabelClass} text-[9px] tracking-tight shrink-0`}>
                                        {shortcut}
                                    </kbd>
                                </div>
                                {(hostname || hasBadges) && (
                                    <div className="text-[9px] text-gray-500 truncate leading-none mt-px">
                                        {hostname && <span>{renderHighlightedText(hostname, activeQuery)}</span>}
                                        {INDICATOR_LEGEND.map(({ key, icon, ariaPrefix }) => {
                                            const value = badges[key];
                                            if (value === undefined) {
                                                return null;
                                            }
                                            const indicator = formatIndicator(ariaPrefix, icon, value);
                                            return (
                                                <span
                                                    key={key}
                                                    className={`ml-1 ${key === 'current' ? 'text-cyan-300' : ''}`}
                                                    aria-label={indicator.label}
                                                >
                                                    {indicator.text}
                                                </span>
                                            );
                                        })}
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
                    Page {pageIndex + 1}/{pageCount} · <kbd className={keyLabelClass}>,</kbd>/<kbd className={keyLabelClass}>←</kbd> previous · <kbd className={keyLabelClass}>.</kbd>/<kbd className={keyLabelClass}>→</kbd> next
                </div>
            )}
            <div
                className={`text-[10px] text-gray-500 px-1 py-1 ${errorMessage
                    ? 'rounded-md border border-red-500/80 bg-red-950/40 text-red-200'
                    : ''}`}
            >
                {errorMessage && (
                    <div role="alert" className="mb-1 text-[10px] font-medium text-red-300">
                        {errorMessage}
                    </div>
                )}
                {searchQuery !== undefined && (
                    <>
                        <div aria-label="Search" className="mb-1 font-mono text-cyan-200">
                            /{searchQuery}
                        </div>
                        <div aria-label="Search shortcuts" className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-gray-400">
                            <span><kbd className={keyLabelClass}>Esc</kbd> exit</span>
                            <span><kbd className={keyLabelClass}>Enter</kbd> {searchQuery === '' && lastSearchQuery ? 'last' : 'keep'}</span>
                            <span><kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>Enter</kbd> activate</span>
                            <span><kbd className={keyLabelClass}>Backspace</kbd> delete</span>
                            <span><kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>W</kbd> / <kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>Backspace</kbd> clear</span>
                        </div>
                    </>
                )}
                {selectedTabId === undefined && (
                    <div className="mb-1">Press a key to select a tab</div>
                )}
                {legendItems.length > 0 && (
                    <div aria-label="Indicator legend" className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {legendItems.map((item) => (
                            <span key={item.label} className="shrink-0">
                                {item.icon} {item.label}
                            </span>
                        ))}
                    </div>
                )}
                <div aria-label="Toggle shortcut help">
                    <kbd className={keyLabelClass}>?</kbd> shortcuts
                </div>
            </div>
            {showHelp && (
                <div
                    role="dialog"
                    aria-label="Shortcut help"
                    className="fixed inset-0 z-50 flex items-end justify-center p-2"
                >
                    <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
                    <div className="relative z-10 w-full max-h-[85%] overflow-y-auto rounded-md border border-cyan-500/40 bg-[#151518] p-3 text-[10px] text-gray-300 shadow-xl shadow-black/50">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="font-semibold text-gray-200">Select next action:</div>
                            <div className="text-gray-500">
                                <kbd className={keyLabelClass}>?</kbd> close
                            </div>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-[9px] text-gray-400">
                            <li><kbd className={keyLabelClass}>/</kbd>: Enter search mode</li>
                            <li><kbd className={keyLabelClass}>n</kbd>: Jump to next search match</li>
                            <li><kbd className={keyLabelClass}>j</kbd>/<kbd className={keyLabelClass}>k</kbd> or <kbd className={keyLabelClass}>↓</kbd>/<kbd className={keyLabelClass}>↑</kbd>: Move selection down/up (pages at edges)</li>
                            <li><kbd className={keyLabelClass}>J</kbd>/<kbd className={keyLabelClass}>PageDown</kbd> / <kbd className={keyLabelClass}>K</kbd>/<kbd className={keyLabelClass}>PageUp</kbd>: Jump to last/first item (change page at edge)</li>
                            <li><kbd className={keyLabelClass}>]</kbd>/<kbd className={keyLabelClass}>[</kbd>: Move selected tab to the right/left of current tab (and go there)</li>
                            <li
                                aria-disabled={moveBesideActiveDisabled ? 'true' : undefined}
                                className={moveBesideActiveDisabled ? 'opacity-40' : undefined}
                            >
                                <kbd className={moveBesideActiveDisabled ? inactiveKeyLabelClass : keyLabelClass}>{`}`}</kbd>/
                                <kbd className={moveBesideActiveDisabled ? inactiveKeyLabelClass : keyLabelClass}>{`{`}</kbd>
                                : Move selected tab to the right/left of current tab (stay in popup)
                            </li>
                            <li><kbd className={keyLabelClass}>&lt;</kbd>/<kbd className={keyLabelClass}>&gt;</kbd>: Move the active tab left/right</li>
                            <li><kbd className={keyLabelClass}>!</kbd>: Break selected tab into a new window</li>
                            <li><kbd className={keyLabelClass}>Enter</kbd>: Activate tab</li>
                            <li><kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>w</kbd>: Close selected tab</li>
                            <li><kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>c</kbd>: Copy selected tab URL</li>
                            <li><kbd className={keyLabelClass}>Ctrl</kbd>+<kbd className={keyLabelClass}>v</kbd>: Paste URL into selected tab</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export { TabList, TabListProps };