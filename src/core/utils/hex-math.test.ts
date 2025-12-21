/**
 * Tests for hex-math utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  hex,
  hexEquals,
  hexAdd,
  hexSubtract,
  hexScale,
  hexDistance,
  hexNeighbors,
  hexNeighbor,
  hexAdjacent,
  hexesInRadius,
  hexRing,
  coordToKey,
  keyToCoord,
  axialToPixel,
  pixelToAxial,
  axialRound,
  hexCorners,
  hexWidth,
  hexHeight,
  hexHorizontalSpacing,
  hexVerticalSpacing,
} from './hex-math';

describe('#2707 hex-math', () => {
  // ==========================================================================
  // Coordinate Operations
  // ==========================================================================

  describe('hex()', () => {
    it('creates a hex coordinate', () => {
      const h = hex(3, -2);
      expect(h.q).toBe(3);
      expect(h.r).toBe(-2);
    });
  });

  describe('hexEquals()', () => {
    it('returns true for equal coordinates', () => {
      expect(hexEquals(hex(1, 2), hex(1, 2))).toBe(true);
    });

    it('returns false for different coordinates', () => {
      expect(hexEquals(hex(1, 2), hex(1, 3))).toBe(false);
      expect(hexEquals(hex(1, 2), hex(2, 2))).toBe(false);
    });
  });

  describe('hexAdd()', () => {
    it('adds two coordinates', () => {
      const result = hexAdd(hex(1, 2), hex(3, -1));
      expect(result).toEqual(hex(4, 1));
    });

    it('handles negative coordinates', () => {
      const result = hexAdd(hex(-2, 3), hex(1, -4));
      expect(result).toEqual(hex(-1, -1));
    });
  });

  describe('hexSubtract()', () => {
    it('subtracts coordinates', () => {
      const result = hexSubtract(hex(5, 3), hex(2, 1));
      expect(result).toEqual(hex(3, 2));
    });
  });

  describe('hexScale()', () => {
    it('scales a coordinate', () => {
      const result = hexScale(hex(2, -3), 2);
      expect(result).toEqual(hex(4, -6));
    });

    it('handles zero scale', () => {
      const result = hexScale(hex(5, 5), 0);
      expect(result).toEqual(hex(0, 0));
    });
  });

  // ==========================================================================
  // Distance and Neighbors
  // ==========================================================================

  describe('hexDistance()', () => {
    it('returns 0 for same coordinate', () => {
      expect(hexDistance(hex(3, 2), hex(3, 2))).toBe(0);
    });

    it('returns 1 for adjacent hexes', () => {
      expect(hexDistance(hex(0, 0), hex(1, 0))).toBe(1);
      expect(hexDistance(hex(0, 0), hex(0, 1))).toBe(1);
      expect(hexDistance(hex(0, 0), hex(1, -1))).toBe(1);
    });

    it('calculates correct distance for non-adjacent hexes', () => {
      expect(hexDistance(hex(0, 0), hex(2, 0))).toBe(2);
      expect(hexDistance(hex(0, 0), hex(3, -3))).toBe(3);
      expect(hexDistance(hex(-2, 1), hex(2, -1))).toBe(4);
    });

    it('is symmetric', () => {
      const a = hex(3, -2);
      const b = hex(-1, 4);
      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });
  });

  describe('hexNeighbors()', () => {
    it('returns 6 neighbors', () => {
      const neighbors = hexNeighbors(hex(0, 0));
      expect(neighbors).toHaveLength(6);
    });

    it('returns correct neighbors for origin', () => {
      const neighbors = hexNeighbors(hex(0, 0));
      expect(neighbors).toContainEqual(hex(1, 0)); // E
      expect(neighbors).toContainEqual(hex(1, -1)); // NE
      expect(neighbors).toContainEqual(hex(0, -1)); // NW
      expect(neighbors).toContainEqual(hex(-1, 0)); // W
      expect(neighbors).toContainEqual(hex(-1, 1)); // SW
      expect(neighbors).toContainEqual(hex(0, 1)); // SE
    });

    it('all neighbors have distance 1', () => {
      const center = hex(5, -3);
      const neighbors = hexNeighbors(center);
      for (const neighbor of neighbors) {
        expect(hexDistance(center, neighbor)).toBe(1);
      }
    });
  });

  describe('hexNeighbor()', () => {
    it('returns correct neighbor by direction', () => {
      const center = hex(0, 0);
      expect(hexNeighbor(center, 0)).toEqual(hex(1, 0)); // E
      expect(hexNeighbor(center, 1)).toEqual(hex(1, -1)); // NE
      expect(hexNeighbor(center, 2)).toEqual(hex(0, -1)); // NW
      expect(hexNeighbor(center, 3)).toEqual(hex(-1, 0)); // W
      expect(hexNeighbor(center, 4)).toEqual(hex(-1, 1)); // SW
      expect(hexNeighbor(center, 5)).toEqual(hex(0, 1)); // SE
    });

    it('wraps direction indices', () => {
      const center = hex(0, 0);
      expect(hexNeighbor(center, 6)).toEqual(hex(1, 0)); // wraps to 0
      expect(hexNeighbor(center, -1)).toEqual(hex(0, 1)); // wraps to 5
    });
  });

  describe('hexAdjacent()', () => {
    it('returns true for adjacent hexes', () => {
      expect(hexAdjacent(hex(0, 0), hex(1, 0))).toBe(true);
      expect(hexAdjacent(hex(3, 2), hex(3, 3))).toBe(true);
    });

    it('returns false for non-adjacent hexes', () => {
      expect(hexAdjacent(hex(0, 0), hex(2, 0))).toBe(false);
      expect(hexAdjacent(hex(0, 0), hex(0, 0))).toBe(false);
    });
  });

  describe('hexesInRadius()', () => {
    it('returns only center for radius 0', () => {
      const hexes = hexesInRadius(hex(3, 2), 0);
      expect(hexes).toEqual([hex(3, 2)]);
    });

    it('returns empty for negative radius', () => {
      const hexes = hexesInRadius(hex(0, 0), -1);
      expect(hexes).toEqual([]);
    });

    it('returns 7 hexes for radius 1 (center + 6 neighbors)', () => {
      const hexes = hexesInRadius(hex(0, 0), 1);
      expect(hexes).toHaveLength(7);
    });

    it('returns 19 hexes for radius 2', () => {
      // Formula: 3*r^2 + 3*r + 1 = 3*4 + 6 + 1 = 19
      const hexes = hexesInRadius(hex(0, 0), 2);
      expect(hexes).toHaveLength(19);
    });

    it('all hexes are within radius', () => {
      const center = hex(5, -3);
      const radius = 3;
      const hexes = hexesInRadius(center, radius);

      for (const h of hexes) {
        expect(hexDistance(center, h)).toBeLessThanOrEqual(radius);
      }
    });
  });

  describe('hexRing()', () => {
    it('returns center for radius 0', () => {
      const ring = hexRing(hex(0, 0), 0);
      expect(ring).toEqual([hex(0, 0)]);
    });

    it('returns 6 hexes for radius 1', () => {
      const ring = hexRing(hex(0, 0), 1);
      expect(ring).toHaveLength(6);
    });

    it('returns 12 hexes for radius 2', () => {
      // Ring size = 6 * radius
      const ring = hexRing(hex(0, 0), 2);
      expect(ring).toHaveLength(12);
    });

    it('all hexes are exactly at ring distance', () => {
      const center = hex(2, -1);
      const radius = 3;
      const ring = hexRing(center, radius);

      for (const h of ring) {
        expect(hexDistance(center, h)).toBe(radius);
      }
    });
  });

  // ==========================================================================
  // Coordinate Keys
  // ==========================================================================

  describe('coordToKey()', () => {
    it('converts coordinate to string key', () => {
      expect(coordToKey(hex(3, -2))).toBe('3,-2');
      expect(coordToKey(hex(0, 0))).toBe('0,0');
      expect(coordToKey(hex(-5, 10))).toBe('-5,10');
    });
  });

  describe('keyToCoord()', () => {
    it('parses valid key', () => {
      expect(keyToCoord('3,-2')).toEqual(hex(3, -2));
      expect(keyToCoord('0,0')).toEqual(hex(0, 0));
      expect(keyToCoord('-5,10')).toEqual(hex(-5, 10));
    });

    it('returns null for invalid keys', () => {
      expect(keyToCoord('')).toBeNull();
      expect(keyToCoord('3')).toBeNull();
      expect(keyToCoord('a,b')).toBeNull();
      expect(keyToCoord('3,4,5')).toBeNull();
    });

    it('roundtrips with coordToKey', () => {
      const original = hex(7, -3);
      const key = coordToKey(original);
      const parsed = keyToCoord(key);
      expect(parsed).toEqual(original);
    });
  });

  // ==========================================================================
  // Pixel Conversion
  // ==========================================================================

  describe('axialToPixel()', () => {
    it('converts origin to pixel origin', () => {
      const pixel = axialToPixel(hex(0, 0), 10);
      expect(pixel.x).toBeCloseTo(0);
      expect(pixel.y).toBeCloseTo(0);
    });

    it('converts positive q to positive x', () => {
      const pixel = axialToPixel(hex(1, 0), 10);
      expect(pixel.x).toBeCloseTo(15); // size * 3/2
      expect(pixel.y).toBeCloseTo(8.66, 1); // size * sqrt(3)/2
    });

    it('converts positive r to positive y', () => {
      const pixel = axialToPixel(hex(0, 1), 10);
      expect(pixel.x).toBeCloseTo(0);
      expect(pixel.y).toBeCloseTo(17.32, 1); // size * sqrt(3)
    });
  });

  describe('pixelToAxial()', () => {
    it('converts pixel origin to hex origin', () => {
      const coord = pixelToAxial({ x: 0, y: 0 }, 10);
      expect(coord).toEqual(hex(0, 0));
    });

    it('roundtrips with axialToPixel', () => {
      const size = 20;
      const testCases = [
        hex(0, 0),
        hex(1, 0),
        hex(0, 1),
        hex(1, 1),
        hex(-2, 3),
        hex(5, -3),
      ];

      for (const original of testCases) {
        const pixel = axialToPixel(original, size);
        const result = pixelToAxial(pixel, size);
        expect(result).toEqual(original);
      }
    });
  });

  describe('axialRound()', () => {
    it('rounds exact coordinates', () => {
      expect(axialRound({ q: 3, r: 2 })).toEqual(hex(3, 2));
    });

    it('rounds fractional coordinates to nearest hex', () => {
      expect(axialRound({ q: 0.3, r: 0.1 })).toEqual(hex(0, 0));
      expect(axialRound({ q: 0.6, r: 0.1 })).toEqual(hex(1, 0));
    });
  });

  // ==========================================================================
  // Hex Geometry
  // ==========================================================================

  describe('hexCorners()', () => {
    it('returns 6 corners', () => {
      const corners = hexCorners({ x: 0, y: 0 }, 10);
      expect(corners).toHaveLength(6);
    });

    it('corners are at correct distance from center', () => {
      const center = { x: 50, y: 50 };
      const size = 20;
      const corners = hexCorners(center, size);

      for (const corner of corners) {
        const dx = corner.x - center.x;
        const dy = corner.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeCloseTo(size);
      }
    });
  });

  describe('hex dimensions', () => {
    it('hexWidth returns correct value', () => {
      expect(hexWidth(10)).toBe(20);
    });

    it('hexHeight returns correct value', () => {
      expect(hexHeight(10)).toBeCloseTo(17.32, 1);
    });

    it('hexHorizontalSpacing returns correct value', () => {
      expect(hexHorizontalSpacing(10)).toBe(15);
    });

    it('hexVerticalSpacing returns correct value', () => {
      expect(hexVerticalSpacing(10)).toBeCloseTo(17.32, 1);
    });
  });
});
