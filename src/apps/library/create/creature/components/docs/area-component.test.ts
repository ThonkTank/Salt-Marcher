// src/apps/library/create/creature/components/area-component.test.ts
// Tests for the Area component

import {
  validateAreaSize,
  normalizeAreaSize,
  formatAreaString,
  formatOriginString,
  generateAreaPreview,
  toAreaComponentType,
  fromAreaComponentType,
  validateAreaComponent,
  type AreaInstance,
} from "../ui-components";
import type { AreaComponent } from "../types";

// Mock DOM environment for testing
const setupDOM = () => {
  // Basic DOM setup for testing
  if (typeof document === "undefined") {
    console.warn("Tests require DOM environment");
  }
};

describe("Area Component", () => {
  beforeAll(() => {
    setupDOM();
  });

  describe("validateAreaSize", () => {
    it("should validate positive numbers", () => {
      expect(validateAreaSize(5)).toBe(true);
      expect(validateAreaSize(15)).toBe(true);
      expect(validateAreaSize(100)).toBe(true);
      expect(validateAreaSize(0.5)).toBe(true);
    });

    it("should validate positive number strings", () => {
      expect(validateAreaSize("5")).toBe(true);
      expect(validateAreaSize("15")).toBe(true);
      expect(validateAreaSize("100")).toBe(true);
      expect(validateAreaSize("0.5")).toBe(true);
    });

    it("should reject negative numbers", () => {
      expect(validateAreaSize(-5)).toBe(false);
      expect(validateAreaSize("-5")).toBe(false);
    });

    it("should reject zero", () => {
      expect(validateAreaSize(0)).toBe(false);
      expect(validateAreaSize("0")).toBe(false);
    });

    it("should reject invalid strings", () => {
      expect(validateAreaSize("")).toBe(false);
      expect(validateAreaSize("abc")).toBe(false);
      expect(validateAreaSize("10abc")).toBe(false);
    });

    it("should reject infinity", () => {
      expect(validateAreaSize(Infinity)).toBe(false);
      expect(validateAreaSize(-Infinity)).toBe(false);
    });

    it("should reject NaN", () => {
      expect(validateAreaSize(NaN)).toBe(false);
    });
  });

  describe("normalizeAreaSize", () => {
    it("should return numbers as-is", () => {
      expect(normalizeAreaSize(5)).toBe(5);
      expect(normalizeAreaSize(15.5)).toBe(15.5);
    });

    it("should parse number strings", () => {
      expect(normalizeAreaSize("5")).toBe(5);
      expect(normalizeAreaSize("15.5")).toBe(15.5);
    });

    it("should handle strings with whitespace", () => {
      expect(normalizeAreaSize("  5  ")).toBe(5);
    });
  });

  describe("formatAreaString", () => {
    describe("cone", () => {
      it("should format cone area", () => {
        const area: AreaInstance = {
          shape: "cone",
          size: 60,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("60-foot cone");
      });

      it("should use singular for 1 foot", () => {
        const area: AreaInstance = {
          shape: "cone",
          size: 1,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("1-foot cone");
      });

      it("should format meters", () => {
        const area: AreaInstance = {
          shape: "cone",
          size: 18,
          unit: "meters",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("18-meter cone");
      });
    });

    describe("sphere", () => {
      it("should format sphere area", () => {
        const area: AreaInstance = {
          shape: "sphere",
          size: 20,
          unit: "feet",
          origin: "point",
        };
        expect(formatAreaString(area)).toBe("20-foot radius sphere");
      });
    });

    describe("cube", () => {
      it("should format cube area", () => {
        const area: AreaInstance = {
          shape: "cube",
          size: 10,
          unit: "feet",
          origin: "point",
        };
        expect(formatAreaString(area)).toBe("10-foot cube");
      });
    });

    describe("line", () => {
      it("should format line without width", () => {
        const area: AreaInstance = {
          shape: "line",
          size: 60,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("60-foot line");
      });

      it("should format line with width", () => {
        const area: AreaInstance = {
          shape: "line",
          size: 100,
          secondarySize: 5,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("100-foot line that is 5 feet wide");
      });

      it("should use singular for 1 foot width", () => {
        const area: AreaInstance = {
          shape: "line",
          size: 60,
          secondarySize: 1,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("60-foot line that is 1 foot wide");
      });
    });

    describe("cylinder", () => {
      it("should format cylinder without height", () => {
        const area: AreaInstance = {
          shape: "cylinder",
          size: 10,
          unit: "feet",
          origin: "point",
        };
        expect(formatAreaString(area)).toBe("10-foot radius cylinder");
      });

      it("should format cylinder with height", () => {
        const area: AreaInstance = {
          shape: "cylinder",
          size: 10,
          secondarySize: 40,
          unit: "feet",
          origin: "point",
        };
        expect(formatAreaString(area)).toBe("10-foot radius, 40-foot high cylinder");
      });
    });

    describe("emanation", () => {
      it("should format emanation area", () => {
        const area: AreaInstance = {
          shape: "emanation",
          size: 10,
          unit: "feet",
          origin: "self",
        };
        expect(formatAreaString(area)).toBe("10-foot emanation");
      });
    });
  });

  describe("formatOriginString", () => {
    it("should format self origin", () => {
      const area: AreaInstance = {
        shape: "cone",
        size: 60,
        unit: "feet",
        origin: "self",
      };
      expect(formatOriginString(area)).toBe("Originates from self");
    });

    it("should format point origin", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "point",
      };
      expect(formatOriginString(area)).toBe("Originates from a point within range");
    });

    it("should format target origin", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 10,
        unit: "feet",
        origin: "target",
      };
      expect(formatOriginString(area)).toBe("Originates from target creature");
    });

    it("should format custom origin with notes", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "custom",
        notes: "a point you can see within 120 feet",
      };
      expect(formatOriginString(area)).toBe("a point you can see within 120 feet");
    });

    it("should format custom origin without notes", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "custom",
      };
      expect(formatOriginString(area)).toBe("Custom origin");
    });

    it("should format arbitrary string origin", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "a creature you touch",
      };
      expect(formatOriginString(area)).toBe("a creature you touch");
    });
  });

  describe("generateAreaPreview", () => {
    it("should generate preview for all shapes", () => {
      const shapes: Array<AreaInstance["shape"]> = [
        "cone",
        "sphere",
        "cube",
        "line",
        "cylinder",
        "emanation",
      ];

      shapes.forEach((shape) => {
        const area: AreaInstance = {
          shape,
          size: 20,
          unit: "feet",
          origin: "self",
        };
        const preview = generateAreaPreview(area);
        expect(preview).toBeTruthy();
        expect(typeof preview).toBe("string");
        expect(preview.length).toBeGreaterThan(0);
      });
    });
  });

  describe("toAreaComponentType", () => {
    it("should convert simple area instance", () => {
      const instance: AreaInstance = {
        shape: "cone",
        size: 60,
        unit: "feet",
        origin: "self",
      };

      const component = toAreaComponentType(instance);

      expect(component.type).toBe("area");
      expect(component.shape).toBe("cone");
      expect(component.size).toBe("60");
      expect(component.origin).toBe("Originates from self");
    });

    it("should convert area with secondary size", () => {
      const instance: AreaInstance = {
        shape: "line",
        size: 100,
        secondarySize: 5,
        unit: "feet",
        origin: "self",
      };

      const component = toAreaComponentType(instance);

      expect(component.type).toBe("area");
      expect(component.shape).toBe("line");
      expect(component.size).toBe("100 × 5");
    });

    it("should include notes", () => {
      const instance: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "custom",
        notes: "Special origin note",
      };

      const component = toAreaComponentType(instance);

      expect(component.notes).toBe("Special origin note");
    });
  });

  describe("fromAreaComponentType", () => {
    it("should convert simple area component", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "cone",
        size: "60",
        origin: "Originates from self",
      };

      const instance = fromAreaComponentType(component);

      expect(instance.shape).toBe("cone");
      expect(instance.size).toBe(60);
      expect(instance.origin).toBe("self");
      expect(instance.unit).toBe("feet");
    });

    it("should convert area with secondary size", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "line",
        size: "100 × 5",
        origin: "Originates from self",
      };

      const instance = fromAreaComponentType(component);

      expect(instance.shape).toBe("line");
      expect(instance.size).toBe(100);
      expect(instance.secondarySize).toBe(5);
    });

    it("should infer origin from string", () => {
      const pointComponent: AreaComponent = {
        type: "area",
        shape: "sphere",
        size: "20",
        origin: "Originates from a point within range",
      };

      const targetComponent: AreaComponent = {
        type: "area",
        shape: "sphere",
        size: "20",
        origin: "Originates from target creature",
      };

      expect(fromAreaComponentType(pointComponent).origin).toBe("point");
      expect(fromAreaComponentType(targetComponent).origin).toBe("target");
    });

    it("should handle custom origin", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "sphere",
        size: "20",
        origin: "a creature you touch",
        notes: "Special note",
      };

      const instance = fromAreaComponentType(component);

      expect(instance.origin).toBe("a creature you touch");
      expect(instance.notes).toBe("Special note");
    });
  });

  describe("validateAreaComponent", () => {
    it("should validate valid area component", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "cone",
        size: "60",
        origin: "Originates from self",
      };

      const errors = validateAreaComponent(component);
      expect(errors).toHaveLength(0);
    });

    it("should detect missing shape", () => {
      const component = {
        type: "area",
        size: "60",
      } as AreaComponent;

      const errors = validateAreaComponent(component);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("shape"))).toBe(true);
    });

    it("should detect missing size", () => {
      const component = {
        type: "area",
        shape: "cone",
        size: "",
      } as AreaComponent;

      const errors = validateAreaComponent(component);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("size"))).toBe(true);
    });

    it("should detect invalid size", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "cone",
        size: "abc",
      };

      const errors = validateAreaComponent(component);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("size"))).toBe(true);
    });

    it("should detect negative size", () => {
      const component: AreaComponent = {
        type: "area",
        shape: "cone",
        size: "-10",
      };

      const errors = validateAreaComponent(component);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should validate size with secondary dimension", () => {
      const validComponent: AreaComponent = {
        type: "area",
        shape: "line",
        size: "100 × 5",
      };

      const invalidComponent: AreaComponent = {
        type: "area",
        shape: "line",
        size: "100 × abc",
      };

      expect(validateAreaComponent(validComponent)).toHaveLength(0);
      expect(validateAreaComponent(invalidComponent).length).toBeGreaterThan(0);
    });
  });

  describe("round-trip conversion", () => {
    it("should preserve data through conversion cycle", () => {
      const original: AreaInstance = {
        shape: "cone",
        size: 60,
        unit: "feet",
        origin: "self",
      };

      const component = toAreaComponentType(original);
      const converted = fromAreaComponentType(component);

      expect(converted.shape).toBe(original.shape);
      expect(converted.size).toBe(original.size);
      expect(converted.origin).toBe(original.origin);
    });

    it("should preserve secondary dimension", () => {
      const original: AreaInstance = {
        shape: "line",
        size: 100,
        secondarySize: 5,
        unit: "feet",
        origin: "self",
      };

      const component = toAreaComponentType(original);
      const converted = fromAreaComponentType(component);

      expect(converted.shape).toBe(original.shape);
      expect(converted.size).toBe(original.size);
      expect(converted.secondarySize).toBe(original.secondarySize);
    });
  });

  describe("real-world examples", () => {
    it("should format Ancient Red Dragon breath weapon", () => {
      const area: AreaInstance = {
        shape: "cone",
        size: 90,
        unit: "feet",
        origin: "self",
      };

      expect(formatAreaString(area)).toBe("90-foot cone");
    });

    it("should format Fireball spell", () => {
      const area: AreaInstance = {
        shape: "sphere",
        size: 20,
        unit: "feet",
        origin: "point",
      };

      expect(formatAreaString(area)).toBe("20-foot radius sphere");
    });

    it("should format Lightning Bolt spell", () => {
      const area: AreaInstance = {
        shape: "line",
        size: 100,
        secondarySize: 5,
        unit: "feet",
        origin: "self",
      };

      expect(formatAreaString(area)).toBe("100-foot line that is 5 feet wide");
    });

    it("should format Spirit Guardians spell", () => {
      const area: AreaInstance = {
        shape: "emanation",
        size: 15,
        unit: "feet",
        origin: "self",
      };

      expect(formatAreaString(area)).toBe("15-foot emanation");
    });

    it("should format Flame Strike spell", () => {
      const area: AreaInstance = {
        shape: "cylinder",
        size: 10,
        secondarySize: 40,
        unit: "feet",
        origin: "point",
      };

      expect(formatAreaString(area)).toBe("10-foot radius, 40-foot high cylinder");
    });
  });
});
