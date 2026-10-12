// Local-calendar date helpers. Never use toISOString() for a calendar date:
// in Addis Ababa (UTC+3) it returns the previous day between 00:00 and 03:00.
export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function todayIso(): string {
  return toIso(new Date());
}
export function formatDate(s: string, locale: 'en' | 'am'): string {
  return parseIso(s).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
export function formatDateTime(s: string, locale: 'en' | 'am'): string {
  return new Date(s).toLocaleString(locale === 'am' ? 'am-ET' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
