// salt-marcher/tests/library/create-creature-validation.test.ts
// Prüft die Abschnittsvalidierungen des Creature-Editors für Skills und Einträge.
import { describe, expect, it } from "vitest";
import type { StatblockData } from "../../src/apps/library/core/creature-files";
import { collectStatsAndSkillsIssues } from "../../src/apps/library/create/creature/section-stats-and-skills";
import { collectEntryDependencyIssues } from "../../src/apps/library/create/creature/section-entries";

describe("collectStatsAndSkillsIssues", () => {
  it("meldet Expertise ohne zugehörige Proficiency", () => {
    const data: StatblockData = {
      name: "Test",
      skillsProf: ["Stealth"],
      skillsExpertise: ["Arcana"],
    };

    expect(collectStatsAndSkillsIssues(data)).toEqual([
      'Expertise für "Arcana" setzt eine Profizient voraus.',
    ]);
  });

  it("liefert keine Meldung für korrekte Expertise", () => {
    const data: StatblockData = {
      name: "Test",
      skillsProf: ["Stealth"],
      skillsExpertise: ["Stealth"],
    };

    expect(collectStatsAndSkillsIssues(data)).toEqual([]);
  });
});

describe("collectEntryDependencyIssues", () => {
  const baseEntry = { category: "action" as const, name: "" };

  it("fasst fehlende abhängige Angaben zusammen", () => {
    const data: StatblockData = {
      name: "Test",
      entries: [
        { ...baseEntry, name: "Odem", save_ability: "DEX" },
        { ...baseEntry, name: "Frost", save_dc: 15 },
        { ...baseEntry, name: "Schmettern", to_hit_from: { ability: "" as any } },
        { ...baseEntry, name: "Hieb", damage_from: { dice: "  ", ability: "str", bonus: undefined } },
      ],
    };

    expect(collectEntryDependencyIssues(data)).toEqual([
      "Odem: Save-DC angeben, wenn ein Attribut gewählt wurde.",
      "Frost: Ein Save-DC benötigt ein Attribut.",
      "Schmettern: Automatische Attacke benötigt ein Attribut.",
      "Hieb: Automatischer Schaden benötigt Würfelangaben.",
    ]);
  });

  it("ignoriert vollständig gepflegte Einträge", () => {
    const data: StatblockData = {
      name: "Test",
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
    };

    expect(collectEntryDependencyIssues(data)).toEqual([]);
  });
});
