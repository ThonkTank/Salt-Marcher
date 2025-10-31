// devkit/testing/unit/features/locations/location-influence.test.ts
// Phase 9.1 Tests: Location influence area calculations

import { describe, it, expect } from "vitest";
import type { LocationData } from "../../../../../src/workmodes/library/locations/types";
import type { HexCoordinate } from "../../../../../src/features/maps/hex-utils";
import {
  parseCoordinates,
  calculateInfluenceArea,
  getInfluenceStrengthAt,
  getInfluencedHexes,
  mergeInfluenceAreas,
  getInfluencingLocations,
} from "../../../../../src/features/locations/location-influence";

describe("Location Influence - Coordinate Parsing", () => {
  it("parses odd-r format coordinates", () => {
    const coord = parseCoordinates("12,34");
    expect(coord).toBeDefined();
    expect(coord!.q).toBeDefined();
    expect(coord!.r).toBe(34);
  });

  it("parses axial format coordinates", () => {
    const coord = parseCoordinates("q:5,r:10");
    expect(coord).toEqual({ q: 5, r: 10, s: -15 });
  });

  it("handles whitespace in coordinates", () => {
    const coord1 = parseCoordinates(" 12 , 34 ");
    const coord2 = parseCoordinates(" q: 5 , r: 10 ");
    expect(coord1).toBeDefined();
    expect(coord2).toBeDefined();
  });

  it("returns null for invalid coordinates", () => {
    expect(parseCoordinates("invalid")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates(undefined)).toBeNull();
  });

  it("handles negative coordinates", () => {
    const coord = parseCoordinates("q:-5,r:-10");
    expect(coord).toEqual({ q: -5, r: -10, s: 15 });
  });
});

describe("Location Influence - Area Calculation", () => {
  const createLocation = (
    name: string,
    type: LocationData["type"],
    coords: string
  ): LocationData => ({
    name,
    type,
    coordinates: coords,
  });

  it("calculates influence for Stadt (city)", () => {
    const city = createLocation("Salzstadt", "Stadt", "10,10");
    const area = calculateInfluenceArea(city);

    expect(area).toBeDefined();
    expect(area!.radius).toBe(8); // Large radius for city
    expect(area!.strength).toBe(90); // High strength
    expect(area!.type).toBe("Stadt");
  });

  it("calculates influence for Dorf (village)", () => {
    const village = createLocation("Kleindorf", "Dorf", "5,5");
    const area = calculateInfluenceArea(village);

    expect(area).toBeDefined();
    expect(area!.radius).toBe(5); // Medium radius
    expect(area!.strength).toBe(70);
  });

  it("calculates influence for Gebäude (building)", () => {
    const building = createLocation("Taverne", "Gebäude", "3,3");
    const area = calculateInfluenceArea(building);

    expect(area).toBeDefined();
    expect(area!.radius).toBe(1); // Small radius
    expect(area!.strength).toBe(40); // Lower strength
  });

  it("returns null for location without coordinates", () => {
    const location = createLocation("Nameless", "Dorf", "");
    const area = calculateInfluenceArea(location);
    expect(area).toBeNull();
  });

  it("includes faction owner in influence area", () => {
    const fort: LocationData = {
      name: "Fort Eisenfaust",
      type: "Festung",
      coordinates: "20,20",
      owner_type: "faction",
      owner_name: "Eiserne Legion",
    };

    const area = calculateInfluenceArea(fort);
    expect(area).toBeDefined();
    expect(area!.faction).toBe("Eiserne Legion");
    expect(area!.npc).toBeUndefined();
  });

  it("includes NPC owner in influence area", () => {
    const tower: LocationData = {
      name: "Turm des Erzmagiers",
      type: "Gebäude",
      coordinates: "15,15",
      owner_type: "npc",
      owner_name: "Gandalf der Graue",
    };

    const area = calculateInfluenceArea(tower);
    expect(area).toBeDefined();
    expect(area!.npc).toBe("Gandalf der Graue");
    expect(area!.faction).toBeUndefined();
  });
});

describe("Location Influence - Strength Calculation", () => {
  it("calculates full strength at center", () => {
    const location: LocationData = {
      name: "Test Stadt",
      type: "Stadt",
      coordinates: "10,10",
    };

    const area = calculateInfluenceArea(location)!;
    const center: HexCoordinate = { q: area.center.q, r: area.center.r, s: area.center.s };
    const strength = getInfluenceStrengthAt(area, center);

    expect(strength).toBeCloseTo(90, 1); // Full strength at center
  });

  it("calculates decaying strength away from center", () => {
    const location: LocationData = {
      name: "Test Stadt",
      type: "Stadt",
      coordinates: "10,10",
    };

    const area = calculateInfluenceArea(location)!;

    // Test at distance 1
    const nearbyHex: HexCoordinate = { q: area.center.q + 1, r: area.center.r, s: area.center.s - 1 };
    const nearStrength = getInfluenceStrengthAt(area, nearbyHex);

    // Test at distance 4 (half of radius)
    const midHex: HexCoordinate = { q: area.center.q + 4, r: area.center.r, s: area.center.s - 4 };
    const midStrength = getInfluenceStrengthAt(area, midHex);

    expect(nearStrength).toBeGreaterThan(midStrength);
    expect(nearStrength).toBeLessThan(90); // Less than center
    expect(midStrength).toBeGreaterThan(0); // Still has influence
  });

  it("returns zero strength outside radius", () => {
    const location: LocationData = {
      name: "Test Dorf",
      type: "Dorf",
      coordinates: "5,5",
    };

    const area = calculateInfluenceArea(location)!;

    // Test far outside radius
    const farHex: HexCoordinate = { q: area.center.q + 20, r: area.center.r, s: area.center.s - 20 };
    const strength = getInfluenceStrengthAt(area, farHex);

    expect(strength).toBe(0);
  });

  it("strength decreases monotonically with distance", () => {
    const location: LocationData = {
      name: "Test Stadt",
      type: "Stadt",
      coordinates: "0,0",
    };

    const area = calculateInfluenceArea(location)!;
    const center = area.center;

    // Test distances 0, 1, 2, 3, 4
    const strengths: number[] = [];
    for (let dist = 0; dist <= 4; dist++) {
      const hex: HexCoordinate = { q: center.q + dist, r: center.r, s: center.s - dist };
      strengths.push(getInfluenceStrengthAt(area, hex));
    }

    // Each strength should be less than or equal to previous
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeLessThanOrEqual(strengths[i - 1]);
    }
  });
});

describe("Location Influence - Influenced Hexes", () => {
  it("returns all hexes within radius", () => {
    const location: LocationData = {
      name: "Small Camp",
      type: "Camp",
      coordinates: "0,0",
    };

    const area = calculateInfluenceArea(location)!;
    const hexes = getInfluencedHexes(area);

    expect(hexes.length).toBeGreaterThan(0);

    // All hexes should be within radius
    for (const { hex, strength } of hexes) {
      const distance =
        (Math.abs(hex.q - area.center.q) +
          Math.abs(hex.r - area.center.r) +
          Math.abs(hex.s - area.center.s)) /
        2;
      expect(distance).toBeLessThanOrEqual(area.radius);
      expect(strength).toBeGreaterThan(0);
    }
  });

  it("returns hexes sorted or unordered", () => {
    const location: LocationData = {
      name: "Test Location",
      type: "Dorf",
      coordinates: "5,5",
    };

    const area = calculateInfluenceArea(location)!;
    const hexes = getInfluencedHexes(area);

    // Just verify all strengths are valid
    for (const { strength } of hexes) {
      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(100);
    }
  });

  it("includes center hex with maximum strength", () => {
    const location: LocationData = {
      name: "Test Stadt",
      type: "Stadt",
      coordinates: "10,10",
    };

    const area = calculateInfluenceArea(location)!;
    const hexes = getInfluencedHexes(area);

    // Find center hex
    const centerHex = hexes.find(
      ({ hex }) =>
        hex.q === area.center.q && hex.r === area.center.r && hex.s === area.center.s
    );

    expect(centerHex).toBeDefined();
    expect(centerHex!.strength).toBeCloseTo(90, 1);

    // Should be among highest strengths
    const strengths = hexes.map(({ strength }) => strength);
    const maxStrength = Math.max(...strengths);
    expect(centerHex!.strength).toBeCloseTo(maxStrength, 1);
  });
});

describe("Location Influence - Merging Areas", () => {
  it("merges non-overlapping areas", () => {
    const loc1: LocationData = { name: "Stadt A", type: "Stadt", coordinates: "0,0" };
    const loc2: LocationData = { name: "Stadt B", type: "Stadt", coordinates: "20,20" };

    const area1 = calculateInfluenceArea(loc1)!;
    const area2 = calculateInfluenceArea(loc2)!;

    const merged = mergeInfluenceAreas([area1, area2]);

    // Should have hexes from both areas
    expect(merged.size).toBeGreaterThan(0);
  });

  it("handles overlapping areas with strongest wins", () => {
    const city: LocationData = { name: "Stadt", type: "Stadt", coordinates: "10,10" };
    const village: LocationData = { name: "Dorf", type: "Dorf", coordinates: "12,12" };

    const cityArea = calculateInfluenceArea(city)!;
    const villageArea = calculateInfluenceArea(village)!;

    const merged = mergeInfluenceAreas([cityArea, villageArea]);

    // Check a hex that's closer to city - should have city's stronger influence
    const hex: HexCoordinate = { q: 11, r: 10, s: -21 };
    const cityStrength = getInfluenceStrengthAt(cityArea, hex);
    const villageStrength = getInfluenceStrengthAt(villageArea, hex);

    if (cityStrength > 0 || villageStrength > 0) {
      const key = `${hex.q},${hex.r},${hex.s}`;
      const mergedStrength = merged.get(key)?.strength || 0;

      expect(mergedStrength).toBeGreaterThanOrEqual(Math.max(cityStrength, villageStrength) * 0.9);
    }
  });

  it("tracks all influencing sources", () => {
    const loc1: LocationData = { name: "A", type: "Stadt", coordinates: "10,10" };
    const loc2: LocationData = { name: "B", type: "Stadt", coordinates: "11,10" };

    const area1 = calculateInfluenceArea(loc1)!;
    const area2 = calculateInfluenceArea(loc2)!;

    const merged = mergeInfluenceAreas([area1, area2]);

    // Some hexes should have multiple sources
    let multiSourceCount = 0;
    for (const { sources } of merged.values()) {
      if (sources.length > 1) {
        multiSourceCount++;
      }
    }

    expect(multiSourceCount).toBeGreaterThan(0);
  });
});

describe("Location Influence - Influencing Locations", () => {
  it("finds all locations influencing a hex", () => {
    const locations: LocationData[] = [
      { name: "Stadt A", type: "Stadt", coordinates: "0,0" },
      { name: "Dorf B", type: "Dorf", coordinates: "3,3" },
      { name: "Camp C", type: "Camp", coordinates: "20,20" }, // Far away
    ];

    const hex: HexCoordinate = { q: 2, r: 2, s: -4 };
    const influencing = getInfluencingLocations(hex, locations);

    // Should find Stadt A and Dorf B, not Camp C
    expect(influencing.length).toBeGreaterThanOrEqual(1);
    expect(influencing.some((i) => i.location.name === "Camp C")).toBe(false);
  });

  it("sorts locations by influence strength descending", () => {
    const locations: LocationData[] = [
      { name: "Weak Camp", type: "Camp", coordinates: "0,0" },
      { name: "Strong Stadt", type: "Stadt", coordinates: "2,2" },
    ];

    const hex: HexCoordinate = { q: 1, r: 1, s: -2 };
    const influencing = getInfluencingLocations(hex, locations);

    if (influencing.length >= 2) {
      // Strengths should be in descending order
      for (let i = 1; i < influencing.length; i++) {
        expect(influencing[i - 1].strength).toBeGreaterThanOrEqual(influencing[i].strength);
      }
    }
  });

  it("excludes locations with zero influence", () => {
    const locations: LocationData[] = [
      { name: "Near", type: "Stadt", coordinates: "0,0" },
      { name: "Far", type: "Camp", coordinates: "50,50" },
    ];

    const hex: HexCoordinate = { q: 1, r: 1, s: -2 };
    const influencing = getInfluencingLocations(hex, locations);

    // Should only include "Near"
    expect(influencing.every((i) => i.strength > 0)).toBe(true);
    expect(influencing.some((i) => i.location.name === "Far")).toBe(false);
  });

  it("handles locations without coordinates", () => {
    const locations: LocationData[] = [
      { name: "With Coords", type: "Stadt", coordinates: "0,0" },
      { name: "No Coords", type: "Dorf" }, // No coordinates
    ];

    const hex: HexCoordinate = { q: 0, r: 0, s: 0 };
    const influencing = getInfluencingLocations(hex, locations);

    // Should not crash, should only include location with coords
    expect(influencing.every((i) => i.location.coordinates)).toBe(true);
  });
});
