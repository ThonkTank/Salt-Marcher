// src/apps/library/create/creature/section-spellcasting.ts
// Compatibility helpers for legacy spellcasting validation in tests.

import type { StatblockData } from "../../core/creature-files";

type LegacySpellGroup = {
  type: "at-will" | "per-day" | "level" | "custom" | string;
  title?: string;
  note?: string;
  uses?: string;
  level?: number;
  slots?: number;
  spells?: Array<{ name?: string } | string>;
};

interface LegacySpellcastingData {
  title?: string;
  ability?: string;
  saveDcOverride?: number;
  attackBonusOverride?: number;
  groups?: LegacySpellGroup[];
}

function normaliseSpellName(entry: { name?: string } | string | undefined): string {
  if (!entry) return "";
  return (typeof entry === "string" ? entry : entry.name ?? "").trim();
}

export function collectSpellcastingIssues(data: StatblockData): string[] {
  const spellcasting = (data as unknown as { spellcasting?: LegacySpellcastingData }).spellcasting;
  if (!spellcasting || !Array.isArray(spellcasting.groups)) {
    return [];
  }

  const issues: string[] = [];
  const seenSpells = new Map<string, number>(); // name -> first group index

  spellcasting.groups.forEach((group, idx) => {
    const groupLabel = idx + 1;
    const trimmedType = (group.type ?? "").toLowerCase();

    if (trimmedType === "per-day") {
      const uses = (group.uses ?? "").trim();
      if (!uses) {
        issues.push(`Gruppe ${groupLabel}: „X/Day“ benötigt eine Nutzungsangabe.`);
      }
    }

    if (trimmedType === "level") {
      const level = group.level;
      if (typeof level !== "number" || level < 0 || level > 9) {
        issues.push(`Gruppe ${groupLabel}: Zaubergrad muss zwischen 0 und 9 liegen.`);
      }
    }

    if (trimmedType === "custom") {
      const title = (group.title ?? "").trim();
      if (!title) {
        issues.push(`Gruppe ${groupLabel}: Custom-Gruppen benötigen einen Titel.`);
      }
    }

    (group.spells ?? []).forEach((entry, spellIdx) => {
      const name = normaliseSpellName(entry);
      if (!name) {
        issues.push(`Gruppe ${groupLabel}: Eintrag ${spellIdx + 1} benötigt einen Namen.`);
        return;
      }

      const normalized = name.toLowerCase();
      if (seenSpells.has(normalized)) {
        const firstOccurrence = seenSpells.get(normalized)!;
        issues.push(`Zauber „${name}" erscheint mehrfach (Gruppen ${firstOccurrence} und ${groupLabel}).`);
      } else {
        seenSpells.set(normalized, groupLabel);
      }
    });
  });

  return issues;
}
