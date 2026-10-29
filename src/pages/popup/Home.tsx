import type { PopupPresenter } from './PopupPresenter';

type HomeProps = {
  presenter: PopupPresenter;
};

export default function Home({ presenter }: HomeProps) {
  return (
    <main className="mt-4 px-1">
      <h1 className="mb-1 text-base font-semibold text-gray-100">Home</h1>
      <p className="mb-4 text-xs text-gray-400">Choose an extension feature.</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => presenter.openPage('tabManagement')}
          className="flex w-full items-center gap-3 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-3 text-left hover:bg-gray-700"
        >
          <kbd className="rounded border border-cyan-400/60 px-1 font-mono text-cyan-200">1</kbd>
          <span>
            <span className="block text-sm text-gray-100">Tab Management</span>
            <span className="text-[10px] text-gray-400">Search, organize, and switch tabs</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => presenter.openPage('settings')}
          className="flex w-full items-center gap-3 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-3 text-left hover:bg-gray-700"
        >
          <kbd className="rounded border border-cyan-400/60 px-1 font-mono text-cyan-200">2</kbd>
          <span className="text-sm text-gray-100">Settings</span>
        </button>
      </div>
      <p className="mt-4 text-[10px] text-gray-500">
        Press <kbd className="font-mono text-cyan-200">1</kbd> or <kbd className="font-mono text-cyan-200">2</kbd> to open a page.
      </p>
    </main>
  );
}
