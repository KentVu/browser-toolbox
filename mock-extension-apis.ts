(global as any).chrome = {
  tabs: {
    _tabs: [] as any[],
    create: async function(opts: { url?: string }) {
      const tab = { id: Date.now(), title: opts.url || '', url: opts.url };
      this._tabs.push(tab);
      return tab;
    },
    query: async function() {
      return this._tabs;
    },
    activate: async function(tabId: number) {
      const idx = this._tabs.findIndex((t: any) => t.id === tabId);
      if (idx > -1) {
        const [tab] = this._tabs.splice(idx, 1);
        this._tabs.unshift(tab);
      }
    }
  }
};
