import { useEffect } from 'preact/hooks';
import Home from './Home';
import Settings from './Settings';
import { TabList } from './TabList';
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
      const key = event.ctrlKey ? `ctrl+${pressed}` : event.shiftKey ? event.key : pressed;
      if (page === 'tabManagement') {
        const { showHelp, searchQuery } = presenter.s();
        if (pressed === 'escape' && (showHelp || searchQuery !== undefined)) {
          event.preventDefault();
        }
        if (key === 'ctrl+w' || key === 'ctrl+c' || key === 'ctrl+v' || key === 'ctrl+backspace') {
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
          <TabList presenter={presenter.tabManagementPresenter} />
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
