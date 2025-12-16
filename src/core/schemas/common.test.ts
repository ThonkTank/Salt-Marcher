import { describe, it, expect } from 'vitest';
import {
  entityIdSchema,
  timestampSchema,
  entityTypeSchema,
  timeSegmentSchema,
  appErrorSchema,
} from './common';

describe('Schemas', () => {
  describe('entityIdSchema', () => {
    it('validates non-empty strings', () => {
      const schema = entityIdSchema('map');
      expect(schema.safeParse('valid-id').success).toBe(true);
      expect(schema.safeParse('a').success).toBe(true);
    });

    it('rejects empty strings', () => {
      const schema = entityIdSchema('map');
      expect(schema.safeParse('').success).toBe(false);
    });

    it('rejects non-strings', () => {
      const schema = entityIdSchema('map');
      expect(schema.safeParse(123).success).toBe(false);
      expect(schema.safeParse(null).success).toBe(false);
      expect(schema.safeParse(undefined).success).toBe(false);
    });
  });

  describe('timestampSchema', () => {
    it('validates positive integers', () => {
      expect(timestampSchema.safeParse(1700000000000).success).toBe(true);
      expect(timestampSchema.safeParse(0).success).toBe(true);
    });

    it('rejects negative numbers', () => {
      expect(timestampSchema.safeParse(-1).success).toBe(false);
    });

    it('rejects floats', () => {
      expect(timestampSchema.safeParse(123.45).success).toBe(false);
    });

    it('rejects non-numbers', () => {
      expect(timestampSchema.safeParse('1700000000000').success).toBe(false);
      expect(timestampSchema.safeParse(null).success).toBe(false);
    });
  });

  describe('entityTypeSchema', () => {
    it('validates all entity types', () => {
      const validTypes = [
        'creature',
        'character',
        'npc',
        'faction',
        'item',
        'map',
        'location',
        'maplink',
        'terrain',
        'quest',
        'encounter',
        'shop',
        'calendar',
        'journal',
        'worldevent',
        'track',
      ];

      for (const type of validTypes) {
        expect(entityTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('rejects invalid types', () => {
      expect(entityTypeSchema.safeParse('invalid').success).toBe(false);
      expect(entityTypeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('timeSegmentSchema', () => {
    it('validates all time segments', () => {
      const validSegments = [
        'dawn',
        'morning',
        'midday',
        'afternoon',
        'dusk',
        'night',
      ];

      for (const segment of validSegments) {
        expect(timeSegmentSchema.safeParse(segment).success).toBe(true);
      }
    });

    it('rejects invalid segments', () => {
      expect(timeSegmentSchema.safeParse('evening').success).toBe(false);
      expect(timeSegmentSchema.safeParse('').success).toBe(false);
    });
  });

  describe('appErrorSchema', () => {
    it('validates minimal error', () => {
      const result = appErrorSchema.safeParse({
        code: 'NOT_FOUND',
        message: 'Entity not found',
      });
      expect(result.success).toBe(true);
    });

    it('validates error with details', () => {
      const result = appErrorSchema.safeParse({
        code: 'VALIDATION_FAILED',
        message: 'Invalid data',
        details: { field: 'name', reason: 'too short' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing code', () => {
      const result = appErrorSchema.safeParse({
        message: 'Error message',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty code', () => {
      const result = appErrorSchema.safeParse({
        code: '',
        message: 'Error message',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing message', () => {
      const result = appErrorSchema.safeParse({
        code: 'ERROR',
      });
      expect(result.success).toBe(false);
    });
  });
});
