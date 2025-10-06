// tests/damage-component.test.ts
// Unit tests for the damage component

import { describe, it, expect } from "vitest";
import {
  validateDiceNotation,
  parseDiceNotation,
  calculateAverageDamage,
  formatDamageString,
  damageInstancesToString,
  parseDamageString,
  type DamageInstance,
} from "../src/apps/library/create/creature/components/damage-component";
import type { StatblockData } from "../src/apps/core/creature-files";

describe("Damage Component", () => {
  describe("validateDiceNotation", () => {
    it("should validate correct dice notation", () => {
      expect(validateDiceNotation("1d6")).toBe(true);
      expect(validateDiceNotation("2d8")).toBe(true);
      expect(validateDiceNotation("3d10+2")).toBe(true);
      expect(validateDiceNotation("1d12-1")).toBe(true);
      expect(validateDiceNotation("10d20+15")).toBe(true);
    });

    it("should reject invalid dice notation", () => {
      expect(validateDiceNotation("")).toBe(false);
      expect(validateDiceNotation("abc")).toBe(false);
      expect(validateDiceNotation("1d")).toBe(false);
      expect(validateDiceNotation("d6")).toBe(false);
      expect(validateDiceNotation("1d6+")).toBe(false);
      expect(validateDiceNotation("1d6++2")).toBe(false);
      expect(validateDiceNotation("1d6 + 2")).toBe(false); // Spaces not allowed
    });

    it("should handle case insensitivity", () => {
      expect(validateDiceNotation("1D6")).toBe(true);
      expect(validateDiceNotation("2D8+3")).toBe(true);
    });
  });

  describe("parseDiceNotation", () => {
    it("should parse dice notation correctly", () => {
      expect(parseDiceNotation("1d6")).toEqual({
        count: 1,
        sides: 6,
        modifier: 0,
      });

      expect(parseDiceNotation("2d8+3")).toEqual({
        count: 2,
        sides: 8,
        modifier: 3,
      });

      expect(parseDiceNotation("3d10-2")).toEqual({
        count: 3,
        sides: 10,
        modifier: -2,
      });
    });

    it("should return null for invalid notation", () => {
      expect(parseDiceNotation("invalid")).toBeNull();
      expect(parseDiceNotation("")).toBeNull();
      expect(parseDiceNotation("1d6 + 2")).toBeNull();
    });

    it("should handle case insensitivity", () => {
      expect(parseDiceNotation("1D6")).toEqual({
        count: 1,
        sides: 6,
        modifier: 0,
      });
    });
  });

  describe("calculateAverageDamage", () => {
    it("should calculate average damage correctly", () => {
      // 1d6: average = 3.5 -> 3 (floor)
      expect(calculateAverageDamage("1d6")).toBe(3);

      // 2d6: average = 7.0 -> 7
      expect(calculateAverageDamage("2d6")).toBe(7);

      // 1d8+2: average = 4.5 + 2 = 6.5 -> 6
      expect(calculateAverageDamage("1d8+2")).toBe(6);

      // With bonus parameter
      expect(calculateAverageDamage("1d8", 3)).toBe(7); // 4.5 + 3 = 7.5 -> 7
    });

    it("should handle dice notation with modifiers", () => {
      // 2d6+4: average = 7 + 4 = 11
      expect(calculateAverageDamage("2d6+4")).toBe(11);

      // 1d10-1: average = 5.5 - 1 = 4.5 -> 4
      expect(calculateAverageDamage("1d10-1")).toBe(4);
    });

    it("should return 0 for invalid notation", () => {
      expect(calculateAverageDamage("invalid")).toBe(0);
      expect(calculateAverageDamage("")).toBe(0);
    });
  });

  describe("formatDamageString", () => {
    const mockData: Partial<StatblockData> = {
      str: 16, // +3
      dex: 14, // +2
      con: 12, // +1
    };

    it("should format damage with fixed bonus", () => {
      const instance: DamageInstance = {
        dice: "2d6",
        bonus: 4,
        damageType: "slashing",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("11 (2d6 +4) slashing");
    });

    it("should format damage with auto bonus from ability", () => {
      const instance: DamageInstance = {
        dice: "1d8",
        bonus: "auto",
        bonusAbility: "str",
        damageType: "piercing",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("7 (1d8 +3) piercing");
    });

    it("should format damage without bonus", () => {
      const instance: DamageInstance = {
        dice: "2d4",
        damageType: "fire",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("5 (2d4) fire");
    });

    it("should include condition when present", () => {
      const instance: DamageInstance = {
        dice: "3d6",
        damageType: "cold",
        condition: "if target is prone",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("10 (3d6) cold (if target is prone)");
    });

    it("should handle negative bonuses", () => {
      const instance: DamageInstance = {
        dice: "1d6",
        bonus: -1,
        damageType: "bludgeoning",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("2 (1d6 -1) bludgeoning");
    });

    it("should handle best_of_str_dex ability", () => {
      const instance: DamageInstance = {
        dice: "1d8",
        bonus: "auto",
        bonusAbility: "best_of_str_dex",
        damageType: "slashing",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      // Should use STR (+3) since it's higher than DEX (+2)
      expect(result).toBe("7 (1d8 +3) slashing");
    });
  });

  describe("damageInstancesToString", () => {
    const mockData: Partial<StatblockData> = {
      str: 16,
      dex: 14,
    };

    it("should combine multiple damage instances", () => {
      const damages: DamageInstance[] = [
        { dice: "2d6", bonus: 4, damageType: "slashing" },
        { dice: "2d4", damageType: "fire", isAdditional: true },
      ];

      const result = damageInstancesToString(damages, mockData as StatblockData);
      expect(result).toBe("11 (2d6 +4) slashing, plus 5 (2d4) fire");
    });

    it("should filter out invalid damage instances", () => {
      const damages: DamageInstance[] = [
        { dice: "2d6", damageType: "slashing" },
        { dice: "", damageType: "fire" }, // Invalid, should be filtered
        { dice: "1d8", damageType: "piercing", isAdditional: true },
      ];

      const result = damageInstancesToString(damages, mockData as StatblockData);
      expect(result).toBe("7 (2d6) slashing, plus 4 (1d8) piercing");
    });

    it("should handle single damage instance", () => {
      const damages: DamageInstance[] = [
        { dice: "1d10", bonus: 3, damageType: "bludgeoning" },
      ];

      const result = damageInstancesToString(damages, mockData as StatblockData);
      expect(result).toBe("8 (1d10 +3) bludgeoning");
    });

    it("should return empty string for empty array", () => {
      const result = damageInstancesToString([], mockData as StatblockData);
      expect(result).toBe("");
    });
  });

  describe("parseDamageString", () => {
    it("should parse simple damage string", () => {
      const result = parseDamageString("13 (2d6 + 4) slashing");

      expect(result).toHaveLength(1);
      expect(result[0].dice).toBe("2d6");
      expect(result[0].bonus).toBe(4);
      expect(result[0].damageType).toBe("slashing");
      expect(result[0].isAdditional).toBe(false);
    });

    it("should parse multiple damage instances", () => {
      const result = parseDamageString("13 (2d6 + 4) slashing, plus 5 (2d4) fire");

      expect(result).toHaveLength(2);

      expect(result[0].dice).toBe("2d6");
      expect(result[0].damageType).toBe("slashing");
      expect(result[0].isAdditional).toBe(false);

      expect(result[1].dice).toBe("2d4");
      expect(result[1].damageType).toBe("fire");
      expect(result[1].isAdditional).toBe(true);
    });

    it("should handle damage without bonus", () => {
      const result = parseDamageString("7 (2d6) fire");

      expect(result).toHaveLength(1);
      expect(result[0].dice).toBe("2d6");
      expect(result[0].bonus).toBeUndefined();
      expect(result[0].damageType).toBe("fire");
    });

    it("should handle various damage types", () => {
      const types = ["fire", "cold", "lightning", "necrotic", "radiant"];

      types.forEach((type) => {
        const result = parseDamageString(`10 (2d8) ${type}`);
        expect(result[0].damageType).toBe(type);
      });
    });

    it("should return empty array for empty string", () => {
      expect(parseDamageString("")).toHaveLength(0);
      expect(parseDamageString("  ")).toHaveLength(0);
    });

    it("should handle case insensitivity for damage types", () => {
      const result = parseDamageString("13 (2d6) SLASHING");
      expect(result[0].damageType).toBe("slashing");
    });
  });

  describe("Edge cases", () => {
    it("should handle large dice values", () => {
      expect(validateDiceNotation("100d100+999")).toBe(true);

      const parsed = parseDiceNotation("100d100+999");
      expect(parsed).toEqual({
        count: 100,
        sides: 100,
        modifier: 999,
      });
    });

    it("should handle damage with zero bonus", () => {
      const mockData: Partial<StatblockData> = { str: 10 }; // +0 modifier

      const instance: DamageInstance = {
        dice: "1d8",
        bonus: "auto",
        bonusAbility: "str",
        damageType: "slashing",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("4 (1d8) slashing"); // No bonus shown when 0
    });

    it("should handle missing ability scores", () => {
      const mockData: Partial<StatblockData> = {}; // No abilities

      const instance: DamageInstance = {
        dice: "1d6",
        bonus: "auto",
        bonusAbility: "str",
        damageType: "bludgeoning",
      };

      const result = formatDamageString(instance, mockData as StatblockData);
      expect(result).toBe("3 (1d6) bludgeoning"); // Falls back to 0 bonus
    });
  });
});
