// salt-marcher/tests/library/create-spell-validation.test.ts
// Prüft die Validierungsregeln für skalierende Zauberstufen im Spell-Editor.
import { describe, expect, it } from "vitest";
import type { SpellData } from "../../src/apps/library/core/spell-files";
import {
  SCALING_DISALLOWS_CANTRIPS_MESSAGE,
  SCALING_REQUIRES_LEVEL_MESSAGE,
  collectSpellScalingIssues,
} from "../../src/apps/library/create/spell/validation";

describe("collectSpellScalingIssues", () => {
  it("meldet fehlende Gradangaben bei gepflegtem Skalierungstext", () => {
    const data: SpellData = {
      name: "Skalierender Zauber",
      higher_levels: "Mehr Schaden pro Slot.",
    };

    expect(collectSpellScalingIssues(data)).toEqual([
      SCALING_REQUIRES_LEVEL_MESSAGE,
    ]);
  });

  it("untersagt Skalierungsnotizen für Zaubertricks", () => {
    const data: SpellData = {
      name: "Cantrip",
      level: 0,
      higher_levels: "Wirkt stärker.",
    };

    expect(collectSpellScalingIssues(data)).toEqual([
      SCALING_DISALLOWS_CANTRIPS_MESSAGE,
    ]);
  });

  it("akzeptiert Skalierungshinweise für reguläre Zauber", () => {
    const data: SpellData = {
      name: "Feuerball",
      level: 3,
      higher_levels: "+1W6 Schaden pro Slot.",
    };

    expect(collectSpellScalingIssues(data)).toEqual([]);
  });

  it("ignoriert leere Skalierungstexte", () => {
    const data: SpellData = {
      name: "Leer",
      level: 2,
      higher_levels: "   ",
    };

    expect(collectSpellScalingIssues(data)).toEqual([]);
  });
});
