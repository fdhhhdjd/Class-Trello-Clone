import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, Button, Spinner, useToast, color, space, font, radius } from '@trello/ui';
import { api } from '../lib/api';

export function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const previewQ = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => (await api.get(`/workspaces/invites/${token}`)).data,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post(`/workspaces/invites/${token}/accept`),
    onSuccess: (res) => {
      toast.success('Joined workspace.');
      navigate(`/w/${res.data.workspaceId}`);
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not join.'),
  });

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.surfaceAlt, padding: space.lg }}>
      <Card style={{ width: 420, maxWidth: '100%', textAlign: 'center' }}>
        {previewQ.isLoading && <Spinner size={24} />}
        {previewQ.isError && (
          <>
            <h2 style={{ fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.text }}>Invite invalid</h2>
            <p style={{ color: color.textMuted, fontSize: 14 }}>This invite link is invalid, revoked, or expired.</p>
            <Button variant="secondary" onClick={() => navigate('/')}>Go home</Button>
          </>
        )}
        {previewQ.data && (
          <>
            <div style={{ width: 64, height: 64, margin: '0 auto', borderRadius: radius.large, background: color.primaryBadgeBg, color: color.blue, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28 }}>
              {(previewQ.data.workspace?.name ?? 'W')[0]?.toUpperCase()}
            </div>
            <h2 style={{ fontFamily: font.display, fontSize: 20, fontWeight: 800, color: color.text, margin: `${space.base} 0 4px` }}>
              {previewQ.data.workspace?.name}
            </h2>
            <p style={{ color: color.textMuted, fontSize: 14, margin: `0 0 ${space.lg}` }}>
              You were invited as <strong>{previewQ.data.role?.replace('ws_', '')}</strong>.
            </p>
            <Button loading={accept.isPending} onClick={() => accept.mutate()} style={{ width: '100%' }}>Join workspace</Button>
          </>
        )}
      </Card>
    </div>
  );
}
