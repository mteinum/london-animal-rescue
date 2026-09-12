// UTC constructors are ONLY a zone-independent civil-clock arithmetic device.
// Values are not UTC instants and must never be fed to a local-time formatter.
export function parseDate(value: string): { date: string; clock: number } | null {
  const s = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m && !b) return null;
  const [y, mo, d, h, mi, se] = m
    ? [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)]
    : [+b![3], +b![2], +b![1], +b![4], +b![5], +(b![6] || 0)];
  const clock = Date.UTC(y, mo - 1, d, h, mi, se);
  const dt = new Date(clock);
  if (
    y < 2009 ||
    y > 2100 ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d ||
    h > 23 ||
    mi > 59 ||
    se > 59
  )
    return null;
  return { date: dt.toISOString().slice(0, 19), clock };
}
export function validDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && parseDate(s + 'T00:00:00') !== null;
}
export function displayDate(s: string, time = true): string {
  const [day, clock] = s.split('T');
  const [y, m, d] = day.split('-');
  return `${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y}${time && clock ? ` · ${clock.slice(0, 5)}` : ''}`;
}
export const civilISO = (clock: number): string => new Date(clock).toISOString().slice(0, 19);
