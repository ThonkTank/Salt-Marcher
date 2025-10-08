// salt-marcher/tests/library/statblock-to-markdown.test.ts
// Prüft den Markdown-Export von Statblocks auf neue Metadaten (Typ-Tags, Alignment-Override, Spellcasting-Gruppen).

import { describe, expect, it } from "vitest";
import { statblockToMarkdown, type StatblockData } from "../../src/apps/library/core/creature-files";
import { EXAMPLE_CREATURE_STATBLOCKS } from "./creature-fixtures";

function createStatblock(overrides: Partial<StatblockData> = {}): StatblockData {
  return {
    name: "Fixture",
    ...overrides,
  };
}

describe("statblockToMarkdown", () => {
  it("rendert Typ-Tags im Frontmatter und in der Kopfzeile", () => {
    const markdown = statblockToMarkdown(
      createStatblock({
        size: "Large",
        type: "Construct",
        typeTags: ["warforged", "soldier"],
        alignmentLawChaos: "Lawful",
        alignmentGoodEvil: "Good",
      }),
    );

    expect(markdown).toContain('type_tags: ["warforged", "soldier"]');
    expect(markdown).toContain("*Large Construct (warforged, soldier), Lawful Good*");
  });

  it("nutzt Alignment-Override für Unaligned-Ausgabe", () => {
    const markdown = statblockToMarkdown(
      createStatblock({
        size: "Tiny",
        type: "Beast",
        typeTags: ["familiar"],
        alignmentOverride: "Unaligned",
      }),
    );

    expect(markdown).toContain('alignment: "Unaligned"');
    expect(markdown).toContain('alignment_override: "Unaligned"');
    expect(markdown).toContain("*Tiny Beast (familiar), Unaligned*");
  });

  it("gibt Spellcasting-Gruppen mit Überschriften und Details aus", () => {
    const witch = EXAMPLE_CREATURE_STATBLOCKS.find((entry) => entry.name === "Mire Witch");
    expect(witch).toBeDefined();

    const markdown = statblockToMarkdown({ ...witch! });

    expect(markdown).toContain("## Prepared Spells");
    expect(markdown).toContain("The witch is a 9th-level spellcaster.");
    expect(markdown).toContain("Spell save DC 16, +8 to hit with spell attacks.");
    expect(markdown).toContain("### Cantrips");
    expect(markdown).toContain("- Ray of Frost (at will)");
    expect(markdown).toContain("### 3/Day Each");
    expect(markdown).toContain("Innate magic fueled by swamp spirits.");
    expect(markdown).toContain("### 4th Level (3 slots)");
    expect(markdown).toContain("- Bestow Curse (prepared, requires concentration)");
  });
});
