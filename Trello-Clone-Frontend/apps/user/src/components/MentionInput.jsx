import { useState, useRef } from 'react';
import { Input, Avatar, color, radius, space, shadow } from '@trello/ui';

// Single-line comment input with @mention autocomplete over `candidates`
// ([{id,name,email,avatarUrl}]). Reports selected user ids via onMentionsChange.
export function MentionInput({ value, onChange, candidates = [], onMentionsChange, placeholder }) {
  const [query, setQuery] = useState(null); // active @query or null
  const picked = useRef(new Map()); // name -> id
  const wrapRef = useRef(null);

  const emitMentions = (text) => {
    const ids = [];
    for (const [name, id] of picked.current) {
      if (text.includes(`@${name}`)) ids.push(id);
    }
    onMentionsChange?.([...new Set(ids)]);
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    const m = /(?:^|\s)@([\w.\-]*)$/.exec(text);
    setQuery(m ? m[1].toLowerCase() : null);
    emitMentions(text);
  };

  const pick = (u) => {
    const label = (u.name || u.email || 'user').replace(/\s+/g, '');
    const next = value.replace(/(?:^|\s)@([\w.\-]*)$/, (full) => `${full.startsWith(' ') ? ' ' : ''}@${label} `);
    picked.current.set(label, u.id);
    onChange(next);
    setQuery(null);
    emitMentions(next);
  };

  const matches = query == null ? [] : candidates.filter((u) => {
    const hay = `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase();
    return hay.includes(query);
  }).slice(0, 6);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
      <Input placeholder={placeholder} value={value} onChange={handleChange} wrapStyle={{ flex: 1 }} />
      {matches.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, zIndex: 20,
          background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.large,
          boxShadow: shadow.hover, overflow: 'hidden',
        }}>
          {matches.map((u) => (
            <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(u); }}
              style={{
                display: 'flex', alignItems: 'center', gap: space.sm, width: '100%', border: 'none',
                background: 'transparent', cursor: 'pointer', padding: '6px 10px', textAlign: 'left',
              }}>
              <Avatar name={u.name} email={u.email} src={u.avatarUrl} size={24} />
              <span style={{ fontSize: 13, color: color.text }}>{u.name || u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
