import { Modal, color, font, space } from '@trello/ui';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

export const SHORTCUT_GROUPS = [
  {
    title: 'Global',
    items: [
      { keys: [`${mod}`, 'K'], label: 'Open command palette' },
      { keys: ['?'], label: 'Show this help' },
      { keys: ['/'], label: 'Focus search' },
    ],
  },
  {
    title: 'Board',
    items: [
      { keys: ['C'], label: 'Add a card to the first list' },
      { keys: ['F'], label: 'Open filter' },
      { keys: ['B'], label: 'Back to boards' },
    ],
  },
];

function Key({ children }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24,
      padding: '0 7px', fontFamily: font.text, fontSize: 12, fontWeight: 600, color: color.text,
      background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 6,
      boxShadow: `0 1px 0 ${color.border}`,
    }}>{children}</kbd>
  );
}

export function ShortcutsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: color.textMuted, marginBottom: space.sm }}>
              {g.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
              {g.items.map((it) => (
                <div key={it.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.base }}>
                  <span style={{ fontFamily: font.text, fontSize: 14, color: color.text }}>{it.label}</span>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {it.keys.map((k, i) => <Key key={i}>{k}</Key>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
