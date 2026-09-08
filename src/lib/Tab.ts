export interface Tab {
    id: number;
    windowId?: number;
    title: string;
    url?: string;
    lastAccessed?: number;
    icon?: string;
    splitViewId?: number;
}
