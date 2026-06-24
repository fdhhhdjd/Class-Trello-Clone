import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Avatar, Spinner, Button, color, space, font } from '@trello/ui';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

export function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['public-profile', id],
    queryFn: async () => (await api.get(`/users/${id}/profile`)).data,
    retry: false,
  });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: `${space.xxl} ${space.lg}` }}>
      <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 15, color: color.textMuted, border: 'none', background: 'none', cursor: 'pointer', marginBottom: space.lg }}>
        <ArrowLeft size={16} /> Back
      </button>
      {q.isLoading && <Spinner size={24} />}
      {q.isError && <Card><p style={{ color: color.textMuted }}>User not found.</p></Card>}
      {q.data && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: space.base, alignItems: 'center', textAlign: 'center' }}>
          <Avatar name={q.data.name} src={q.data.avatarUrl} size={96} />
          <div>
            <div style={{ fontFamily: font.display, fontSize: 24, fontWeight: 800, color: color.text }}>{q.data.name || 'User'}</div>
            <div style={{ fontSize: 13, color: color.textMuted }}>Joined {new Date(q.data.createdAt).toLocaleDateString()}{!q.data.isActive ? ' · inactive' : ''}</div>
          </div>
          {q.data.bio && <p style={{ fontSize: 15, color: color.text, maxWidth: 480, lineHeight: 1.55 }}>{q.data.bio}</p>}
          {!q.data.bio && <p style={{ fontSize: 14, color: color.textMuted }}>No bio yet.</p>}
        </Card>
      )}
    </div>
  );
}
