import { describe, it, expect } from 'vitest';
import {
  createGrid,
  cellToFeet,
  feetToCell,
  positionToFeet,
  feetToPosition,
  getDistance,
  isWithinBounds,
  clampToGrid,
  getNeighbors,
  getNeighbors3D,
  spreadFormation,
  positionOpposingSides,
  positionToKey,
  keyToPosition,
  positionsEqual,
  getDirection,
  stepToward,
  type GridPosition,
  type GridConfig,
} from '../grid';

describe('grid utilities', () => {
  describe('createGrid', () => {
    it('creates grid with defaults', () => {
      const grid = createGrid({ width: 20, height: 30 });
      expect(grid.cellSizeFeet).toBe(5);
      expect(grid.width).toBe(20);
      expect(grid.height).toBe(30);
      expect(grid.layers).toBe(1);
      expect(grid.diagonalRule).toBe('phb-variant');
    });

    it('creates grid with custom options', () => {
      const grid = createGrid({
        width: 40,
        height: 40,
        layers: 10,
        diagonalRule: 'simple',
      });
      expect(grid.layers).toBe(10);
      expect(grid.diagonalRule).toBe('simple');
    });
  });

  describe('conversion functions', () => {
    describe('cellToFeet', () => {
      it('converts cell index to feet', () => {
        expect(cellToFeet(0)).toBe(0);
        expect(cellToFeet(1)).toBe(5);
        expect(cellToFeet(12)).toBe(60);
      });

      it('uses custom cell size', () => {
        expect(cellToFeet(2, 10)).toBe(20);
      });
    });

    describe('feetToCell', () => {
      it('converts feet to cell index (rounds down)', () => {
        expect(feetToCell(0)).toBe(0);
        expect(feetToCell(5)).toBe(1);
        expect(feetToCell(7)).toBe(1);
        expect(feetToCell(60)).toBe(12);
      });

      it('uses custom cell size', () => {
        expect(feetToCell(25, 10)).toBe(2);
      });
    });

    describe('positionToFeet', () => {
      it('converts GridPosition to feet', () => {
        const pos: GridPosition = { x: 2, y: 3, z: 1 };
        const feet = positionToFeet(pos);
        expect(feet).toEqual({ x: 10, y: 15, z: 5 });
      });
    });

    describe('feetToPosition', () => {
      it('converts feet to GridPosition', () => {
        const feet = { x: 10, y: 15, z: 5 };
        const pos = feetToPosition(feet);
        expect(pos).toEqual({ x: 2, y: 3, z: 1 });
      });
    });
  });

  describe('getDistance', () => {
    describe('phb-variant', () => {
      it('calculates same cell distance as 0', () => {
        const a: GridPosition = { x: 5, y: 5, z: 0 };
        expect(getDistance(a, a)).toBe(0);
      });

      it('calculates cardinal distance correctly', () => {
        const a: GridPosition = { x: 0, y: 0, z: 0 };
        const b: GridPosition = { x: 4, y: 0, z: 0 };
        expect(getDistance(a, b)).toBe(4);
      });

      it('calculates diagonal distance with 1.5 cost', () => {
        const a: GridPosition = { x: 0, y: 0, z: 0 };
        // 3 diagonal moves should cost 3 + floor(3 * 0.5) = 4 cells
        const b: GridPosition = { x: 3, y: 3, z: 0 };
        expect(getDistance(a, b)).toBe(4);
      });

      it('calculates mixed movement correctly', () => {
        const a: GridPosition = { x: 0, y: 0, z: 0 };
        // 4 cells horizontal, 2 diagonal
        const b: GridPosition = { x: 4, y: 2, z: 0 };
        // 4 straight + floor(2 * 0.5) = 4 + 1 = 5
        expect(getDistance(a, b)).toBe(5);
      });

      it('handles 3D distance', () => {
        const a: GridPosition = { x: 0, y: 0, z: 0 };
        const b: GridPosition = { x: 3, y: 3, z: 3 };
        // All axes equal: major=3, mid=3, minor=3
        // 3 + floor(3*0.5) + floor(3*0.5) = 3 + 1 + 1 = 5
        expect(getDistance(a, b)).toBe(5);
      });
    });

    it('throws for unimplemented rules', () => {
      const a: GridPosition = { x: 0, y: 0, z: 0 };
      const b: GridPosition = { x: 1, y: 1, z: 0 };
      expect(() => getDistance(a, b, 'simple')).toThrow('not implemented');
      expect(() => getDistance(a, b, 'euclidean')).toThrow('not implemented');
    });
  });

  describe('bounds functions', () => {
    const config: GridConfig = createGrid({ width: 10, height: 10, layers: 5 });

    describe('isWithinBounds', () => {
      it('returns true for valid positions', () => {
        expect(isWithinBounds({ x: 0, y: 0, z: 0 }, config)).toBe(true);
        expect(isWithinBounds({ x: 9, y: 9, z: 4 }, config)).toBe(true);
        expect(isWithinBounds({ x: 5, y: 5, z: 2 }, config)).toBe(true);
      });

      it('returns false for out-of-bounds positions', () => {
        expect(isWithinBounds({ x: -1, y: 0, z: 0 }, config)).toBe(false);
        expect(isWithinBounds({ x: 10, y: 0, z: 0 }, config)).toBe(false);
        expect(isWithinBounds({ x: 0, y: 10, z: 0 }, config)).toBe(false);
        expect(isWithinBounds({ x: 0, y: 0, z: 5 }, config)).toBe(false);
        expect(isWithinBounds({ x: 0, y: 0, z: -1 }, config)).toBe(false);
      });
    });

    describe('clampToGrid', () => {
      it('returns same position if within bounds', () => {
        const pos = { x: 5, y: 5, z: 2 };
        expect(clampToGrid(pos, config)).toEqual(pos);
      });

      it('clamps negative values to 0', () => {
        expect(clampToGrid({ x: -5, y: -3, z: -1 }, config)).toEqual({ x: 0, y: 0, z: 0 });
      });

      it('clamps values beyond bounds', () => {
        expect(clampToGrid({ x: 15, y: 20, z: 10 }, config)).toEqual({ x: 9, y: 9, z: 4 });
      });
    });
  });

  describe('neighbor functions', () => {
    describe('getNeighbors', () => {
      it('returns 8 horizontal neighbors', () => {
        const neighbors = getNeighbors({ x: 5, y: 5, z: 0 });
        expect(neighbors).toHaveLength(8);
      });

      it('includes all 8 directions', () => {
        const center = { x: 5, y: 5, z: 0 };
        const neighbors = getNeighbors(center);

        const expected = [
          { x: 4, y: 4, z: 0 }, { x: 5, y: 4, z: 0 }, { x: 6, y: 4, z: 0 },
          { x: 4, y: 5, z: 0 },                       { x: 6, y: 5, z: 0 },
          { x: 4, y: 6, z: 0 }, { x: 5, y: 6, z: 0 }, { x: 6, y: 6, z: 0 },
        ];

        for (const exp of expected) {
          expect(neighbors).toContainEqual(exp);
        }
      });

      it('preserves z coordinate', () => {
        const neighbors = getNeighbors({ x: 5, y: 5, z: 3 });
        expect(neighbors.every(n => n.z === 3)).toBe(true);
      });
    });

    describe('getNeighbors3D', () => {
      it('returns 26 3D neighbors', () => {
        const neighbors = getNeighbors3D({ x: 5, y: 5, z: 5 });
        expect(neighbors).toHaveLength(26);
      });

      it('includes vertical neighbors', () => {
        const center = { x: 5, y: 5, z: 5 };
        const neighbors = getNeighbors3D(center);

        expect(neighbors).toContainEqual({ x: 5, y: 5, z: 4 });
        expect(neighbors).toContainEqual({ x: 5, y: 5, z: 6 });
      });
    });
  });

  describe('formation functions', () => {
    describe('spreadFormation', () => {
      it('returns correct number of positions', () => {
        const positions = spreadFormation(6, { x: 0, y: 0, z: 0 }, 2);
        expect(positions).toHaveLength(6);
      });

      it('spreads positions with correct spacing', () => {
        const positions = spreadFormation(4, { x: 10, y: 10, z: 0 }, 2);
        // 4 units in a row
        expect(positions[0].x).toBe(10);
        expect(positions[1].x).toBe(12);
        expect(positions[2].x).toBe(14);
        expect(positions[3].x).toBe(16);
      });

      it('preserves z coordinate', () => {
        const positions = spreadFormation(4, { x: 0, y: 0, z: 3 }, 2);
        expect(positions.every(p => p.z === 3)).toBe(true);
      });
    });

    describe('positionOpposingSides', () => {
      it('positions two groups on opposite sides', () => {
        const { sideA, sideB } = positionOpposingSides(3, 4, 10, 2);

        expect(sideA).toHaveLength(3);
        expect(sideB).toHaveLength(4);

        // Side A starts at x=0
        expect(sideA[0].x).toBe(0);

        // Side B starts at x=10 (distance)
        expect(sideB[0].x).toBe(10);
      });
    });
  });

  describe('utility functions', () => {
    describe('positionToKey / keyToPosition', () => {
      it('converts position to key and back', () => {
        const pos: GridPosition = { x: 5, y: 10, z: 3 };
        const key = positionToKey(pos);
        expect(key).toBe('5,10,3');
        expect(keyToPosition(key)).toEqual(pos);
      });
    });

    describe('positionsEqual', () => {
      it('returns true for equal positions', () => {
        const a = { x: 5, y: 10, z: 3 };
        const b = { x: 5, y: 10, z: 3 };
        expect(positionsEqual(a, b)).toBe(true);
      });

      it('returns false for different positions', () => {
        const a = { x: 5, y: 10, z: 3 };
        expect(positionsEqual(a, { x: 6, y: 10, z: 3 })).toBe(false);
        expect(positionsEqual(a, { x: 5, y: 11, z: 3 })).toBe(false);
        expect(positionsEqual(a, { x: 5, y: 10, z: 4 })).toBe(false);
      });
    });

    describe('getDirection', () => {
      it('returns normalized direction', () => {
        const a = { x: 0, y: 0, z: 0 };
        expect(getDirection(a, { x: 10, y: 5, z: 3 })).toEqual({ x: 1, y: 1, z: 1 });
        expect(getDirection(a, { x: -5, y: -10, z: -1 })).toEqual({ x: -1, y: -1, z: -1 });
        expect(getDirection(a, { x: 0, y: 5, z: 0 })).toEqual({ x: 0, y: 1, z: 0 });
      });
    });

    describe('stepToward', () => {
      it('moves one step toward target', () => {
        const from = { x: 0, y: 0, z: 0 };
        const to = { x: 5, y: 3, z: 2 };
        expect(stepToward(from, to)).toEqual({ x: 1, y: 1, z: 1 });
      });

      it('does not overshoot target', () => {
        const from = { x: 4, y: 4, z: 0 };
        const to = { x: 5, y: 5, z: 0 };
        expect(stepToward(from, to)).toEqual({ x: 5, y: 5, z: 0 });
      });

      it('stays in place when at target', () => {
        const pos = { x: 5, y: 5, z: 0 };
        expect(stepToward(pos, pos)).toEqual(pos);
      });
    });
  });
});
