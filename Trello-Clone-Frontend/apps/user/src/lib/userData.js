import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@trello/ui';
import { api } from './api';

function unwrap(data) {
  if (Array.isArray(data)) return data;
  const items = data?.items ?? data?.data;
  return Array.isArray(items) ? items : [];
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/me/dashboard')).data ?? null,
  });
}

/* ------------------------------------------------------------------ Profile */

export function useUpdateProfile() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patch) => api.patch('/me', patch).then((r) => r.data),
    onSuccess: () => {
      toast.success('Profile updated.');
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Could not update profile.'),
  });
}

// Presigned upload then PATCH /me {avatarUrl}.
export function useUploadAvatar() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (file) => {
      const presign = await api.post('/me/avatar', {
        filename: file.name, contentType: file.type,
      });
      const { uploadUrl, fileUrl } = presign.data;
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const res = await api.patch('/me', { avatarUrl: fileUrl });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Avatar updated.');
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Could not upload avatar.'),
  });
}

export function useChangePassword() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      api.post('/me/change-password', { currentPassword, newPassword }),
    onSuccess: () => toast.success('Password changed.'),
    onError: () => toast.error('Could not change password. Check your current password.'),
  });
}

export function useDeleteAccount() {
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.delete('/me'),
    onSuccess: () => toast.success('Account deleted.'),
    onError: () => toast.error('Could not delete account.'),
  });
}

/* ----------------------------------------------------------------- Settings */

export function useSettings() {
  return useQuery({
    queryKey: ['me', 'settings'],
    queryFn: async () => {
      const res = await api.get('/me/settings');
      return res.data ?? {};
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (settings) => api.patch('/me/settings', { settings }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Settings saved.');
      qc.invalidateQueries({ queryKey: ['me', 'settings'] });
    },
    onError: () => toast.error('Could not save settings.'),
  });
}

/* ------------------------------------------------------------ Notifications */

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return { items: unwrap(res.data), unreadCount: res.data?.unreadCount ?? 0 };
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data?.count ?? 0;
    },
  });
}

function invalidateNotifs(qc) {
  qc.invalidateQueries({ queryKey: ['notifications'] });
  qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: () => invalidateNotifs(qc),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => { invalidateNotifs(qc); },
    onError: () => toast.error('Could not mark all as read.'),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id) => api.delete(`/notifications/${id}`),
    onSuccess: () => invalidateNotifs(qc),
    onError: () => toast.error('Could not delete notification.'),
  });
}
