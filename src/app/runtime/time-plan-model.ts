export function formatDuration(ms: string, daySeconds = 86400) {
  let remaining = BigInt(ms);
  const pieces: string[] = [];
  for (const [unit, label] of [
    [BigInt(daySeconds) * 1000n, 'Tag'],
    [3600000n, 'h'],
    [60000n, 'min'],
  ] as const) {
    const amount = remaining / unit;
    remaining %= unit;
    if (amount)
      pieces.push(String(amount) + ' ' + (label === 'Tag' && amount !== 1n ? 'Tage' : label));
  }
  if (remaining)
    pieces.push(
      String(remaining / 1000n) +
        (remaining % 1000n ? ',' + String(remaining % 1000n).padStart(3, '0') : '') +
        ' s',
    );
  return pieces.join(' ') || '0 s';
}
export function validInstant(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,29})$/.test(value);
}
export function validClockCalendar(
  value: unknown,
): value is { revision: number; daySeconds: number } {
  if (!value || typeof value !== 'object') return false;
  const v = value as { revision: number; daySeconds: number };
  return (
    Number.isSafeInteger(v.revision) &&
    v.revision >= 0 &&
    Number.isSafeInteger(v.daySeconds) &&
    v.daySeconds >= 3600 &&
    v.daySeconds <= 604800
  );
}
