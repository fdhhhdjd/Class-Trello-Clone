import { color, font, space, shadow, radius } from '@trello/ui';

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle at 20% 20%, rgba(168,85,247,0.35), transparent 45%), radial-gradient(circle at 85% 75%, rgba(6,182,212,0.30), transparent 45%), linear-gradient(135deg, ${color.navyDeep} 0%, ${color.blueDark} 100%)`,
        padding: space.lg,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <span style={{
            width: 32, height: 32, borderRadius: radius.large, background: color.white,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 14, background: color.blue, borderRadius: 2, marginRight: 2 }} />
            <span style={{ width: 6, height: 9, background: color.blue, borderRadius: 2 }} />
          </span>
          <span style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: color.white, letterSpacing: '-0.5px' }}>
            Trello
          </span>
        </div>

        <div style={{
          width: '100%', background: color.white, borderRadius: radius.large,
          boxShadow: shadow.modal, padding: space.xl,
        }}>
          <h1 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 600, color: color.navyDeep, margin: 0, textAlign: 'center' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontFamily: font.text, fontSize: 14, color: color.navyLight, textAlign: 'center', margin: `${space.xs} 0 ${space.lg}` }}>
              {subtitle}
            </p>
          )}
          {!subtitle && <div style={{ height: space.lg }} />}
          {children}
        </div>

        {footer && (
          <div style={{ fontFamily: font.text, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
