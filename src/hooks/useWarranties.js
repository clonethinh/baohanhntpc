import { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';

export function useWarranties(params = {}) {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWarranties = useCallback(async (fetchParams = params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/warranties', { params: fetchParams });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarranties();
  }, [fetchWarranties]);

  return { data, loading, error, refetch: fetchWarranties };
}
