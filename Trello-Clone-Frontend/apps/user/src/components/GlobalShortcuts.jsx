import { useState, useEffect } from 'react';
import { useHotkeys, isTyping } from '../lib/useHotkeys';
import { CommandPalette } from './CommandPalette';
import { ShortcutsModal } from './ShortcutsModal';

export function GlobalShortcuts() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setHelpOpen(true);
    window.addEventListener('trello:open-shortcuts', onOpen);
    return () => window.removeEventListener('trello:open-shortcuts', onOpen);
  }, []);

  useHotkeys((e) => {
    const cmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
    if (cmdK) { e.preventDefault(); setPaletteOpen((v) => !v); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping()) return;
    if (e.key === '?') { e.preventDefault(); setHelpOpen(true); }
    else if (e.key === '/') {
      const el = document.querySelector('[data-global-search]');
      if (el) { e.preventDefault(); el.focus(); }
    }
  });

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
