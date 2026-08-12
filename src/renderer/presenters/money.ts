/** One locale-owned copper presenter for every renderer feature. */
export function formatCopper(cp: number): string {
  const whole = Math.floor(cp / 100)
  const remainder = cp % 100
  return remainder === 0
    ? `${whole} GM`
    : `${whole},${String(remainder).padStart(2, '0')} GM`
}
