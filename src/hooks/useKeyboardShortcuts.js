import { useEffect } from 'react';

export function useKeyboardShortcuts({ onSearchFocus, onCloseDrawer, onPrint, onShowShortcuts, onNavigate } = {}) {
  useEffect(() => {
    function handleKeyDown(e) {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target.tagName;
      const isInput = target === 'INPUT' || target === 'TEXTAREA' || target === 'SELECT';

      if (isCtrl && e.key === 'n') {
        e.preventDefault();
        if (onNavigate) onNavigate('/admin/tao-phieu');
      }

      if (isCtrl && e.key === 'k') {
        e.preventDefault();
        if (onSearchFocus) onSearchFocus();
      }

      if (isCtrl && e.key === 'p') {
        e.preventDefault();
        if (onPrint) onPrint();
      }

      if (e.key === 'Escape') {
        if (onCloseDrawer) onCloseDrawer();
      }

      if (e.key === '?' && !isCtrl && !isInput) {
        if (onShowShortcuts) onShowShortcuts();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchFocus, onCloseDrawer, onPrint, onShowShortcuts, onNavigate]);
}
