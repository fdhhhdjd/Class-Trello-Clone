import { useNavigate } from 'react-router-dom';
import { Button, color, space, font } from '@trello/ui';
import { Compass, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/Layout';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="404" breadcrumb={['Admin', 'Not found']} />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: `${space.xxl} ${space.lg}`, gap: space.base,
      }}>
        <span style={{
          width: 72, height: 72, borderRadius: '50%', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(24,104,219,0.12)', color: color.blue,
        }}>
          <Compass size={36} />
        </span>
        <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: color.text }}>
          Page not found
        </div>
        <p style={{ color: color.textMuted, fontSize: 14, maxWidth: 380, margin: 0, lineHeight: '21px' }}>
          The page you are looking for doesn{"'"}t exist or has been moved.
        </p>
        <Button leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/dashboard')} style={{ marginTop: space.sm }}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
