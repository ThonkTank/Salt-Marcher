// src/apps/library/create/shared/stat-utils.ts
// Gemeinsame Hilfsfunktionen für Ability-Scores und formatierte Ausgaben.

/**
 * Extrahiert die erste ganzzahlige Zahl aus dem gegebenen Wert.
 * Unterstützt Strings mit eingebetteten Zahlen (z.\u00a0B. "1d8 + 4").
 */
export function parseIntSafe(value?: string | number | null): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : NaN;
  }
  const match = String(value ?? "").match(/-?\d+/);
  return match ? parseInt(match[0], 10) : NaN;
}

/**
 * Berechnet den Ability-Modifikator f\u00fcr einen gegebenen Score.
 * Nicht parsebare Werte liefern `0`, um UI-Updates robust zu halten.
 */
export function abilityMod(score?: string | number | null): number {
  const numeric = typeof score === "number" ? score : parseIntSafe(score);
  if (Number.isNaN(numeric)) return 0;
  return Math.floor((numeric - 10) / 2);
}

/**
 * Formatiert eine Zahl mit explizitem Vorzeichen (z.\u00a0B. `+3` oder `-1`).
 */
export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}
