export interface Tab {
    id: number;
    title: string;
    url?: string;
    lastAccessed?: number;
    icon?: string;
    splitViewId?: number;
}
