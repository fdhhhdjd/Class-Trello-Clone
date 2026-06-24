import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@trello/ui';
import { api } from './api';

const VALID = new Set(['light', 'dark', 'system']);

export function useSettings() {
  return useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => (await api.get('/me/settings')).data,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings) => api.patch('/me/settings', { settings }),
    onSuccess: (res) => qc.setQueryData(['me', 'settings'], res.data),
  });
}

// Load server theme once and apply it locally (server is source of truth on start).
export function useThemeSync(enabled) {
  const { setTheme } = useTheme();
  const applied = useRef(false);
  const { data } = useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => (await api.get('/me/settings')).data,
    enabled: !!enabled,
  });

  useEffect(() => {
    if (applied.current || !data) return;
    const t = data.theme;
    if (VALID.has(t)) { setTheme(t); applied.current = true; }
  }, [data, setTheme]);
}
