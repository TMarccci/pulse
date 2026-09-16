// Builds a SQL fragment restricting rows to the configured work hours + days.
// Evaluated in the server's local timezone via SQLite's 'localtime' modifier,
// so set the server's TZ to match the workplace. All values are numeric and
// inlined, so the fragment needs no bound parameters.
//
//   settings  merged settings object (uses settings.workHours)
//   apply     whether the caller asked to restrict to work hours
//   col       the unix-seconds timestamp column (e.g. 'ts', 's.ts')
//
// Returns { clause, applied }.
export function workHoursClause(settings, apply, col = 'ts') {
  const wh = settings?.workHours;
  if (!apply || !wh || !wh.enabled) return { clause: '', applied: false };

  const toMin = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10) || 0);
    return Math.max(0, Math.min(1440, h * 60 + m));
  };
  const startMin = toMin(wh.start);
  const endMin = toMin(wh.end);
  const days = Array.isArray(wh.days) && wh.days.length
    ? wh.days.map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];

  const local = `${col}, 'unixepoch', 'localtime'`;
  const minOfDay = `(CAST(strftime('%H', ${local}) AS INTEGER) * 60 + CAST(strftime('%M', ${local}) AS INTEGER))`;
  const dow = `CAST(strftime('%w', ${local}) AS INTEGER)`;

  // Daytime window (start < end) vs overnight window (start >= end).
  const timeClause = startMin < endMin
    ? `${minOfDay} >= ${startMin} AND ${minOfDay} < ${endMin}`
    : `(${minOfDay} >= ${startMin} OR ${minOfDay} < ${endMin})`;

  const dayClause = `${dow} IN (${days.join(',')})`;

  return { clause: ` AND ${dayClause} AND ${timeClause}`, applied: true };
}
