/** Money is integer minor units (cents). These helpers are the only conversion points. */
export function toMinor(major: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(major.trim());
  if (!m) throw new Error('Invalid amount');
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
}

export function formatMoney(minor: number, currency = 'LKR', locale = 'en-LK'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}
