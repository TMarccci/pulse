import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api.js';

// Fetch a path, re-fetch when `deps` change, and optionally poll every `pollMs`.
export function useFetch(path, deps = [], pollMs = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const first = useRef(true);

  const load = useCallback(async (silent) => {
    if (!path) { setData(null); setLoading(false); return; } // skip when disabled
    if (!silent) setLoading(true);
    try {
      const d = await api(path);
      setData(d);
      setError(null);
    } catch (e) {
      if (e.status !== 401) setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    first.current = true;
    load(false);
    if (pollMs > 0) {
      const id = setInterval(() => load(true), pollMs);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => load(true) };
}
