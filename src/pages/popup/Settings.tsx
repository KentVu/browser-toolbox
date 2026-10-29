import { useEffect, useState } from 'preact/hooks';
import type { SettingsPresenter } from './SettingsPresenter';

type SettingsProps = {
  presenter: SettingsPresenter;
  onUpOneLevel: () => void;
};

export default function Settings({ presenter, onUpOneLevel }: SettingsProps) {
  const state = useSettingsState(presenter);

  return (
    <main className="mt-4 px-1">
      <button
        type="button"
        onClick={onUpOneLevel}
        className="mb-3 text-xs text-cyan-200 hover:text-cyan-100"
        aria-label="Up 1 level"
      >
        <kbd className="mr-1 rounded border border-cyan-400/60 px-1 font-mono">u</kbd>
        Up 1 level
      </button>
      <h1 className="mb-4 text-base font-semibold text-gray-100">Settings</h1>
      <label className="flex flex-col gap-2 text-xs text-gray-300" htmlFor="default-mode">
        Default mode
        <select
          id="default-mode"
          aria-label="Default mode"
          value={state.defaultMode}
          onChange={event => void presenter.setDefaultMode(event.currentTarget.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-2 text-gray-100"
        >
          <option value="tabManagement">Tab Management</option>
        </select>
      </label>
      {state.errorMessage && (
        <div role="alert" className="mt-3 rounded border border-red-500/80 bg-red-950/40 p-2 text-xs text-red-200">
          {state.errorMessage}
        </div>
      )}
    </main>
  );
}

function useSettingsState(presenter: SettingsPresenter) {
  const [snapshot, setSnapshot] = useState(presenter.s);
  useEffect(() => {
    setSnapshot(presenter.s());
    return presenter.subscribe(() => setSnapshot(presenter.s()));
  }, [presenter]);
  return snapshot;
}
