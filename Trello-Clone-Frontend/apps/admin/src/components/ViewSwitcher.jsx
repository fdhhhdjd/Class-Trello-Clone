import { List, LayoutGrid, Columns2 } from 'lucide-react';
import { color, space, radius, font, Tooltip } from '@trello/ui';

const MODES = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'matrix', label: 'Matrix', Icon: LayoutGrid },
  { key: 'detail', label: 'Detail', Icon: Columns2 },
];

export function ViewSwitcher({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="View mode"
      style={{
        display: 'inline-flex', gap: 2, padding: 3, borderRadius: radius.large,
        background: color.surfaceAlt, border: `1px solid ${color.border}`,
      }}
    >
      {MODES.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <Tooltip key={key} label={`${label} view`}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: space.xs,
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                borderRadius: radius.base, fontFamily: font.text, fontSize: 13,
                fontWeight: active ? 600 : 500,
                background: active ? color.surface : 'transparent',
                color: active ? color.blue : color.textMuted,
                boxShadow: active ? '0 1px 2px rgba(9,30,66,0.12)' : 'none',
                transition: 'background .12s, color .12s',
              }}
            >
              <Icon size={16} />
              <span className="admin-vs-label">{label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
