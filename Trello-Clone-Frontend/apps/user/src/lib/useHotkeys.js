import { useEffect, useRef } from 'react';

// True when focus is on an editable element; shortcuts should be ignored then.
export function isTyping(el) {
  const t = el || document.activeElement;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

// Global keydown hotkeys. `handler(e)` decides what to do; it receives the event.
// `allowInInputs` keys still fire while typing (e.g. Cmd/Ctrl+K, Escape).
export function useHotkeys(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e) => ref.current?.(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
