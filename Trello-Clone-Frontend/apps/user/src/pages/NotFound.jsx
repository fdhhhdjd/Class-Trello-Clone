import { useNavigate } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button, color, font, space } from '@trello/ui';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: `${space.xxl} ${space.lg}`,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.base }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 88, height: 88, borderRadius: '50%', background: color.primaryBadgeBg, color: color.blue,
        }}>
          <Compass size={44} />
        </div>
        <h1 style={{ fontFamily: font.display, fontSize: 64, fontWeight: 800, color: color.text, margin: 0, lineHeight: 1, letterSpacing: '-1px' }}>
          404
        </h1>
        <h2 style={{ fontFamily: font.display, fontSize: 24, fontWeight: 700, color: color.text, margin: 0 }}>
          Page not found
        </h2>
        <p style={{ fontFamily: font.text, fontSize: 16, color: color.textMuted, margin: 0 }}>
          The page you are looking for does not exist or may have been moved.
        </p>
        <Button leftIcon={<Home size={16} />} onClick={() => navigate('/')} style={{ marginTop: space.sm }}>
          Back to Workspaces
        </Button>
      </div>
    </div>
  );
}
