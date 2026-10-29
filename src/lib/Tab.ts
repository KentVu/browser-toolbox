export interface Tab {
    id: number;
    windowId?: number;
    title: string;
    url?: string;
    lastAccessed?: number;
    icon?: string;
    splitViewId?: number;
    /** Active in its own window. Each window has one active tab. */
    active?: boolean;
}
