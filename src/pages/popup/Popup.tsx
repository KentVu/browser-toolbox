import { useEffect } from 'preact/hooks';
import Home from './Home';
import Settings from './Settings';
import { TabManagement } from './TabManagement';
import { PopupPresenter } from './PopupPresenter';

interface PopupProps {
  presenter: PopupPresenter;
}

export default function Popup({ presenter }: PopupProps) {
  const { page } = presenter.useNavigationState();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        return;
      }

      const pressed = event.key.toLowerCase();
      let key: string;
      if (event.ctrlKey) {
        key = `ctrl+${pressed}`;
      } else if (event.altKey) {
        key = `alt+${pressed}`;
      } else if (event.shiftKey) {
        key = event.key;
      } else {
        key = pressed;
      }
      if (page === 'tabManagement') {
        const { showHelp, searchQuery } = presenter.tabManagementPresenter.s();
        if (pressed === 'escape' && (showHelp || searchQuery !== undefined)) {
          event.preventDefault();
        }
        if (key === 'ctrl+w' || key === 'ctrl+c' || key === 'ctrl+v' || key === 'ctrl+backspace') {
          event.preventDefault();
        }
        if (key === 'alt+]' || key === 'alt+[') {
          event.preventDefault();
        }
      }
      void presenter.onKeyPress(key);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [page, presenter]);

  return (
    <div className="w-[360px] min-h-[480px] p-2.5 bg-[#111113] text-white font-sans text-[13px] leading-tight">
      {page === 'tabManagement' && (
        <>
          <div className="mb-2 px-1 text-center">
            <p className="text-sm font-medium tracking-wide text-gray-200">Tab management</p>
          </div>
          <TabManagement presenter={presenter.tabManagementPresenter} />
        </>
      )}
      {page === 'home' && <Home presenter={presenter} />}
      {page === 'settings' && (
        <Settings
          presenter={presenter.settingsPresenter}
          onUpOneLevel={() => presenter.goUpOneLevel()}
        />
      )}
    </div>
  );
}
