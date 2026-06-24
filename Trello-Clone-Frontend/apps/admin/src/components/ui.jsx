import { useState } from 'react';
import { Info, AlertTriangle, CheckCircle2, Copy, Check } from 'lucide-react';
import { color, space, radius, font, IconButton, useToast } from '@trello/ui';

const ALERT_KINDS = {
  info: { fg: color.blue, bg: color.primaryBadgeBg, border: color.blue, Icon: Info },
  warning: { fg: '#946800', bg: '#FFF7E6', border: '#E0A800', Icon: AlertTriangle },
  danger: { fg: color.danger, bg: color.errorBg, border: color.danger, Icon: AlertTriangle },
  success: { fg: color.success, bg: color.successBg, border: color.success, Icon: CheckCircle2 },
};

export function Alert({ kind = 'info', title, children, style }) {
  const k = ALERT_KINDS[kind] ?? ALERT_KINDS.info;
  const { Icon } = k;
  return (
    <div
      role="alert"
      style={{
        display: 'flex', gap: space.sm, alignItems: 'flex-start',
        background: k.bg, border: `1px solid ${k.border}`, borderRadius: radius.large,
        padding: '10px 12px', fontFamily: font.text, fontSize: 13, color: k.fg,
        lineHeight: '19px', ...style,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

// Read-only field with a copy-to-clipboard button and "copied" feedback.
export function CopyField({ value, mono = true }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value ?? '');
      setCopied(true);
      toast.success('Copied to clipboard.');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed.');
    }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: space.sm }}>
      <code style={{
        flex: 1, padding: '10px 12px', borderRadius: radius.primary, background: color.surfaceAlt,
        border: `1px solid ${color.border}`, color: color.text, fontSize: 15,
        fontFamily: mono ? font.mono : font.text, wordBreak: 'break-all', display: 'flex', alignItems: 'center',
      }}>{value}</code>
      <IconButton label={copied ? 'Copied' : 'Copy'} onClick={onCopy} style={{ alignSelf: 'center' }}>
        {copied ? <Check size={18} style={{ color: color.success }} /> : <Copy size={18} />}
      </IconButton>
    </div>
  );
}
