/** One locale-owned copper presenter for every renderer feature. */
export function formatCopper(cp: number): string {
  const sign = cp < 0 ? '-' : ''
  const value = Math.abs(cp)
  const whole = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0
    ? `${sign}${whole} GM`
    : `${sign}${whole},${String(remainder).padStart(2, '0')} GM`
}
