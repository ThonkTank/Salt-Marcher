// salt-marcher/tests/library/create-creature-validation.test.ts
// Prüft die Abschnittsvalidierungen des Creature-Editors für Skills, Einträge und Spellcasting.
import { describe, expect, it } from "vitest";
import type { StatblockData } from "../../src/apps/library/core/creature-files";
import { collectStatsAndSkillsIssues } from "../../src/apps/library/create/creature/section-stats-and-skills";
import { collectEntryDependencyIssues } from "../../src/apps/library/create/creature/section-entries";
import { collectSpellcastingIssues } from "../../src/apps/library/create/creature/section-spellcasting";

function createCreature(overrides: Partial<StatblockData> = {}): StatblockData {
  return {
    name: "Test",
    ...overrides,
  };
}

describe("collectStatsAndSkillsIssues", () => {
  it("meldet Expertise ohne zugehörige Proficiency", () => {
    const data = createCreature({
      skillsProf: ["Stealth"],
      skillsExpertise: ["Arcana"],
    });

    expect(collectStatsAndSkillsIssues(data)).toEqual([
      'Expertise für "Arcana" setzt eine Profizient voraus.',
    ]);
  });

  it("liefert keine Meldung für korrekte Expertise", () => {
    const data = createCreature({
      skillsProf: ["Stealth"],
      skillsExpertise: ["Stealth"],
    });

    expect(collectStatsAndSkillsIssues(data)).toEqual([]);
  });
});

describe("collectEntryDependencyIssues", () => {
  const baseEntry = { category: "action" as const, name: "" };

  it("fasst fehlende abhängige Angaben zusammen", () => {
    const data = createCreature({
      entries: [
        { ...baseEntry, name: "Odem", save_ability: "DEX" },
        { ...baseEntry, name: "Frost", save_dc: 15 },
        { ...baseEntry, name: "Schmettern", to_hit_from: { ability: "" as any } },
        { ...baseEntry, name: "Hieb", damage_from: { dice: "  ", ability: "str", bonus: undefined } },
      ],
    });

    expect(collectEntryDependencyIssues(data)).toEqual([
      "Odem: Save-DC angeben, wenn ein Attribut gewählt wurde.",
      "Frost: Ein Save-DC benötigt ein Attribut.",
      "Schmettern: Automatische Attacke benötigt ein Attribut.",
      "Hieb: Automatischer Schaden benötigt Würfelangaben.",
    ]);
  });

  it("ignoriert vollständig gepflegte Einträge", () => {
    const data = createCreature({
      entries: [
        {
          category: "action",
          name: "Eisodem",
          save_ability: "CON",
          save_dc: 16,
          save_effect: "half on save",
          damage_from: { dice: "6d6", ability: undefined, bonus: undefined },
        },
      ],
    });

    expect(collectEntryDependencyIssues(data)).toEqual([]);
  });

  it("setzt generische Labels für namenlose Einträge", () => {
    const data = createCreature({
      entries: [
        { ...baseEntry, name: "  ", save_dc: 13 },
      ],
    });

    expect(collectEntryDependencyIssues(data)).toEqual([
      "Eintrag 1: Ein Save-DC benötigt ein Attribut.",
    ]);
  });
});

describe("collectSpellcastingIssues", () => {
  it("meldet fehlende Angaben, ungültige Level und Duplikate trotz Overrides", () => {
    const data = createCreature({
      spellcasting: {
        title: "Innate Magic",
        saveDcOverride: 17,
        attackBonusOverride: 9,
        groups: [
          {
            type: "per-day",
            uses: " ",
            spells: [{ name: "Fog Cloud" }],
          },
          {
            type: "level",
            level: 12,
            spells: [{ name: "Fog Cloud" }],
          },
          {
            type: "custom",
            title: "  ",
            spells: [{ name: "" }],
          },
        ],
      },
    });

    expect(collectSpellcastingIssues(data)).toEqual([
      "Gruppe 1: „X/Day“ benötigt eine Nutzungsangabe.",
      "Gruppe 2: Zaubergrad muss zwischen 0 und 9 liegen.",
      'Zauber „Fog Cloud" erscheint mehrfach (Gruppen 1 und 2).',
      "Gruppe 3: Custom-Gruppen benötigen einen Titel.",
      "Gruppe 3: Eintrag 1 benötigt einen Namen.",
    ]);
  });

  it("liefert keine Meldungen für vollständig gepflegte Gruppen", () => {
    const data = createCreature({
      spellcasting: {
        title: "Disciplined Casting",
        ability: "int",
        saveDcOverride: 15,
        attackBonusOverride: 7,
        notes: ["Spell save DC 15, +7 to hit."],
        groups: [
          {
            type: "at-will",
            title: "Cantrips",
            spells: [{ name: "Ray of Frost" }],
          },
          {
            type: "per-day",
            title: "3/Day Each",
            uses: "3/day each",
            spells: [{ name: "Misty Step", notes: "self only" }],
          },
          {
            type: "level",
            level: 3,
            slots: 3,
            spells: [{ name: "Counterspell", prepared: true }],
          },
          {
            type: "custom",
            title: "Rituals",
            description: "Ritual casting only.",
            spells: [],
          },
        ],
      },
    });

    expect(collectSpellcastingIssues(data)).toEqual([]);
  });
});
