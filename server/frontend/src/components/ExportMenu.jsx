import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { exportUrl } from '../api.js';

// Dropdown that downloads a dataset in CSV / JSON / XLSX.
export function ExportMenu({ kind, params = {}, label = 'Export' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const formats = [['csv', 'CSV'], ['xlsx', 'Excel (XLSX)'], ['json', 'JSON']];
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        <Download size={16} /> {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 card p-1 z-30 min-w-[160px] shadow-xl">
          {formats.map(([fmt, name]) => (
            <a
              key={fmt}
              href={exportUrl(kind, { ...params, format: fmt })}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-md text-sm hover:bg-[var(--color-surface-2)]"
            >
              {name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
