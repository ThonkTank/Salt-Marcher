import type { AtlasCell } from './world-contracts';
export interface HexAccess {
  mode: 'blocked' | 'requires';
  requirement: string;
}
export function checkedHexAccess(value: unknown): HexAccess | undefined {
  if (value === undefined) return;
  const a = value as HexAccess;
  if (
    !a ||
    typeof a !== 'object' ||
    Array.isArray(a) ||
    !['blocked', 'requires'].includes(a.mode) ||
    typeof a.requirement !== 'string' ||
    a.requirement.length > 200 ||
    (a.mode === 'requires' && !a.requirement.trim()) ||
    Object.keys(a).some((k) => !['mode', 'requirement'].includes(k))
  )
    throw new Error('Hex-Passierbarkeit benötigt eine gültige Sperre oder benannte Voraussetzung.');
  return a;
}
export function checkedTravelSupplies(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((s) => typeof s !== 'string' || !s.trim() || s.length > 200) ||
    new Set(value).size !== value.length
  )
    throw new Error('Bestätigte Reisevoraussetzungen prüfen.');
  return value;
}
export function hexAccessProblem(cell: AtlasCell, supplies: readonly string[] = []) {
  const a = checkedHexAccess(cell.access);
  return !a
    ? null
    : a.mode === 'blocked'
      ? 'Hex gesperrt' + (a.requirement ? ' · ' + a.requirement : '')
      : supplies.includes(a.requirement)
        ? null
        : 'Hex benötigt: ' + a.requirement;
}
export function hexAccessLabel(cell: AtlasCell) {
  const a = checkedHexAccess(cell.access);
  return !a
    ? 'Frei passierbar'
    : a.mode === 'blocked'
      ? 'Gesperrt' + (a.requirement ? ' · ' + a.requirement : '')
      : 'Voraussetzung: ' + a.requirement;
}
