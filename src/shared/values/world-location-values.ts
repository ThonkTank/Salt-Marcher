export function canonicalWorldLocationTag(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase()
}
