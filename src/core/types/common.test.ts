import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEntityId,
  toEntityId,
  now,
  toTimestamp,
  createError,
  type EntityId,
  type Timestamp,
  type AppError,
  type MapId,
  type CreatureId,
} from './common';

describe('Common Types', () => {
  describe('createEntityId', () => {
    it('creates a valid UUID string', () => {
      const id = createEntityId<'map'>();
      expect(typeof id).toBe('string');
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('creates unique IDs', () => {
      const id1 = createEntityId<'map'>();
      const id2 = createEntityId<'map'>();
      expect(id1).not.toBe(id2);
    });

    it('type-safety prevents mixing entity types', () => {
      const mapId: MapId = createEntityId<'map'>();
      const creatureId: CreatureId = createEntityId<'creature'>();

      // These are both strings at runtime
      expect(typeof mapId).toBe('string');
      expect(typeof creatureId).toBe('string');

      // TypeScript would prevent: const wrong: MapId = creatureId;
      // But at runtime they're both just strings
    });
  });

  describe('toEntityId', () => {
    it('casts string to EntityId', () => {
      const id: EntityId<'map'> = toEntityId('test-id-123');
      expect(id).toBe('test-id-123');
    });
  });

  describe('now', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns current timestamp', () => {
      const fixedTime = 1700000000000;
      vi.setSystemTime(fixedTime);

      const timestamp = now();
      expect(timestamp).toBe(fixedTime);
    });

    it('is mockable with vi.spyOn', () => {
      const fixedTime = 1234567890000 as Timestamp;
      vi.setSystemTime(fixedTime);

      expect(now()).toBe(fixedTime);
    });
  });

  describe('toTimestamp', () => {
    it('casts number to Timestamp', () => {
      const ts: Timestamp = toTimestamp(1700000000000);
      expect(ts).toBe(1700000000000);
    });
  });

  describe('createError', () => {
    it('creates AppError without details', () => {
      const error: AppError = createError('NOT_FOUND', 'Map not found');
      expect(error).toEqual({
        code: 'NOT_FOUND',
        message: 'Map not found',
      });
    });

    it('creates AppError with details', () => {
      const error: AppError = createError('VALIDATION_FAILED', 'Invalid data', {
        field: 'name',
        reason: 'too short',
      });
      expect(error).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Invalid data',
        details: { field: 'name', reason: 'too short' },
      });
    });
  });

  describe('type aliases', () => {
    it('MapId is EntityId<map>', () => {
      const id: MapId = createEntityId<'map'>();
      // This compiles, proving the types are compatible
      const genericId: EntityId<'map'> = id;
      expect(genericId).toBe(id);
    });
  });
});
