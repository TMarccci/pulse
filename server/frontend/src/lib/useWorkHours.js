import { useState, useCallback } from 'react';

const KEY = 'pulse_work_hours_only';

// Remembers the "work hours only" analytics filter across page loads.
export function useWorkHours() {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);
  return [value, set];
}
