import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Debounced global search hook.
export function useSearch(query) {
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= 2;
  const q = useQuery({
    queryKey: ['search', debounced],
    queryFn: async () => {
      const res = await api.get('/search', { params: { q: debounced } });
      return res.data ?? { cards: [], boards: [] };
    },
    enabled,
  });

  return {
    results: q.data ?? { cards: [], boards: [] },
    isLoading: enabled && q.isLoading,
    active: enabled,
  };
}
