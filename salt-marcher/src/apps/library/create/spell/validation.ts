// src/apps/library/create/spell/validation.ts
// Prüft Spell-Eingaben auf stimmige Angaben zu höherstufigen Zaubern.
import type { SpellData } from "../../core/spell-files";

export const SCALING_REQUIRES_LEVEL_MESSAGE =
    "Skalierende Effekte benötigen einen Zaubergrad zwischen 1 und 9.";
export const SCALING_DISALLOWS_CANTRIPS_MESSAGE =
    "Zaubertricks verwenden keine höheren Zauberstufen – entferne den Abschnitt oder wähle Grad 1–9.";

/**
 * Ermittelt Validierungsfehler rund um die "Höhere Grade"-Angabe.
 * - Setzt einen Zaubergrad voraus, sobald ein Skalierungstext gepflegt wird.
 * - Untersagt Skalierungsangaben für Cantrips (Grad 0), da sie nicht über Slots verstärkt werden.
 */
export function collectSpellScalingIssues(data: SpellData): string[] {
    const issues: string[] = [];
    const scalingText = data.higher_levels?.trim();
    if (!scalingText) return issues;

    const level = data.level;
    if (!Number.isFinite(level)) {
        issues.push(SCALING_REQUIRES_LEVEL_MESSAGE);
        return issues;
    }

    if ((level ?? 0) <= 0) {
        issues.push(SCALING_DISALLOWS_CANTRIPS_MESSAGE);
    }

    return issues;
}
