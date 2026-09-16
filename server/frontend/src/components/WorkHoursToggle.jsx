import { Clock } from 'lucide-react';

// Toggle that restricts analytics/exports to configured work hours. Disabled
// (with a hint) until work hours are enabled in Settings.
export function WorkHoursToggle({ value, onChange, workHours }) {
  const enabled = !!workHours?.enabled;
  const label = enabled ? `Work hours ${workHours.start}–${workHours.end}` : 'Work hours';
  const active = value && enabled;
  return (
    <button
      type="button"
      onClick={() => enabled && onChange(!value)}
      disabled={!enabled}
      title={enabled
        ? 'Restrict analytics to the configured work hours'
        : 'Define work hours in Settings to enable this filter'}
      className={`btn ${active ? 'btn-primary' : ''} ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Clock size={16} /> {label}
    </button>
  );
}
