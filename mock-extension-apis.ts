// Example of declaring a global variable in vitest.
(global as any).chrome = {
  tabs: {
    _tabs: [] as any[],
    _lastAccessed: 0,
    create: async function(opts: { url?: string }) {
      chrome.tabs._lastAccessed++;
      const tab = {
        id: Date.now(),
        title: opts.url || '',
        url: opts.url,
        lastAccessed: chrome.tabs._lastAccessed,
      };
      this._tabs.push(tab);
      return tab;
    },
    query: async function() {
      return this._tabs;
    },
    update: async function(tabId: number, props: { active?: boolean }) {
      if (props && props.active) {
        chrome.tabs._lastAccessed++;
        const idx = this._tabs.findIndex((t: any) => t.id === tabId);
        if (idx > -1) {
          this._tabs[idx].lastAccessed = chrome.tabs._lastAccessed;
        }
      }
    }
  }
};
