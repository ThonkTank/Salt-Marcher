// tests/apps/almanac/default-resolver.test.ts
// Verifies default calendar resolution across global and travel contexts.

/**
 * @file Default Calendar Resolver Tests
 * @description Tests for default calendar management and resolution logic
 * @module tests/apps/almanac
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CalendarSchema } from '../../../src/apps/almanac/domain/calendar-core';
import {
  AlmanacMemoryBackend,
  InMemoryCalendarRepository,
  InMemoryEventRepository,
  InMemoryPhenomenonRepository,
} from '../../../src/apps/almanac/data/repositories';
import { InMemoryStateGateway } from '../../../src/apps/almanac/data/calendar-state-gateway';

describe('Default Calendar Resolver', () => {
  let backend: AlmanacMemoryBackend;
  let calendarRepo: InMemoryCalendarRepository;
  let eventRepo: InMemoryEventRepository;
  let gateway: InMemoryStateGateway;
  let phenomenonRepo: InMemoryPhenomenonRepository;

  const calendar1: CalendarSchema = {
    id: 'cal-1',
    name: 'Calendar 1',
    daysPerWeek: 7,
    months: [
      { id: 'jan', name: 'January', length: 31 },
      { id: 'feb', name: 'February', length: 28 },
    ],
    epoch: { year: 1, monthId: 'jan', day: 1 },
    schemaVersion: '1.0.0',
  };

  const calendar2: CalendarSchema = {
    id: 'cal-2',
    name: 'Calendar 2',
    daysPerWeek: 10,
    months: [
      { id: 'month1', name: 'First', length: 30 },
      { id: 'month2', name: 'Second', length: 30 },
    ],
    epoch: { year: 1, monthId: 'month1', day: 1 },
    schemaVersion: '1.0.0',
  };

  const calendar3: CalendarSchema = {
    id: 'cal-3',
    name: 'Calendar 3',
    daysPerWeek: 7,
    months: [
      { id: 'alpha', name: 'Alpha', length: 20 },
      { id: 'beta', name: 'Beta', length: 20 },
    ],
    epoch: { year: 1, monthId: 'alpha', day: 1 },
    schemaVersion: '1.0.0',
  };

  beforeEach(() => {
    backend = new AlmanacMemoryBackend();
    calendarRepo = new InMemoryCalendarRepository(backend);
    eventRepo = new InMemoryEventRepository(backend);
    phenomenonRepo = new InMemoryPhenomenonRepository(backend);
    gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);
  });

  describe('Global Default', () => {
    it('should set and retrieve global default calendar', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');

      const defaultCal = await calendarRepo.getGlobalDefaultCalendar();
      expect(defaultCal).toBeTruthy();
      expect(defaultCal?.id).toBe('cal-1');
      expect(defaultCal?.isDefaultGlobal).toBe(true);
    });

    it('should remove isDefaultGlobal from previous default when setting new one', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      // Set cal-1 as default
      await calendarRepo.setGlobalDefault('cal-1');

      let cal1 = await calendarRepo.getCalendar('cal-1');
      expect(cal1?.isDefaultGlobal).toBe(true);

      // Set cal-2 as default
      await calendarRepo.setGlobalDefault('cal-2');

      // cal-1 should no longer be default
      cal1 = await calendarRepo.getCalendar('cal-1');
      expect(cal1?.isDefaultGlobal).toBe(false);

      const cal2 = await calendarRepo.getCalendar('cal-2');
      expect(cal2?.isDefaultGlobal).toBe(true);
    });

    it('should return null when no global default is set', async () => {
      await calendarRepo.createCalendar(calendar1);

      const defaultCal = await calendarRepo.getGlobalDefaultCalendar();
      expect(defaultCal).toBeNull();
    });

    it('should throw error when setting non-existent calendar as default', async () => {
      await expect(
        calendarRepo.setGlobalDefault('non-existent')
      ).rejects.toThrow('Calendar with ID non-existent not found');
    });
  });

  describe('Travel-Specific Default', () => {
    it('should set and retrieve travel-specific default', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setTravelDefault('travel-1', 'cal-2');

      const travelDefaultId = await calendarRepo.getTravelDefault('travel-1');
      expect(travelDefaultId).toBe('cal-2');
    });

    it('should return null for travel without specific default', async () => {
      const travelDefaultId = await calendarRepo.getTravelDefault('travel-99');
      expect(travelDefaultId).toBeNull();
    });

    it('should allow different defaults for different travels', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);
      await calendarRepo.createCalendar(calendar3);

      await calendarRepo.setTravelDefault('travel-1', 'cal-1');
      await calendarRepo.setTravelDefault('travel-2', 'cal-2');
      await calendarRepo.setTravelDefault('travel-3', 'cal-3');

      expect(await calendarRepo.getTravelDefault('travel-1')).toBe('cal-1');
      expect(await calendarRepo.getTravelDefault('travel-2')).toBe('cal-2');
      expect(await calendarRepo.getTravelDefault('travel-3')).toBe('cal-3');
    });

    it('should clear travel-specific default', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.setTravelDefault('travel-1', 'cal-1');

      expect(await calendarRepo.getTravelDefault('travel-1')).toBe('cal-1');

      await calendarRepo.clearTravelDefault('travel-1');

      expect(await calendarRepo.getTravelDefault('travel-1')).toBeNull();
    });

    it('should throw error when setting non-existent calendar as travel default', async () => {
      await expect(
        calendarRepo.setTravelDefault('travel-1', 'non-existent')
      ).rejects.toThrow('Calendar with ID non-existent not found');
    });
  });

  describe('Default Resolution Priority', () => {
    it('should resolve travel default over global default', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');
      await calendarRepo.setTravelDefault('travel-1', 'cal-2');

      const snapshot = await gateway.loadSnapshot({ travelId: 'travel-1' });

      expect(snapshot.activeCalendar?.id).toBe('cal-2');
      expect(snapshot.isGlobalDefault).toBe(false);
      expect(snapshot.wasAutoSelected).toBe(false);
    });

    it('should fall back to global default when no travel default exists', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');

      const snapshot = await gateway.loadSnapshot({ travelId: 'travel-1' });

      expect(snapshot.activeCalendar?.id).toBe('cal-1');
      expect(snapshot.isGlobalDefault).toBe(true);
      expect(snapshot.wasAutoSelected).toBe(false);
    });

    it('should auto-select first available calendar when no defaults exist', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      const snapshot = await gateway.loadSnapshot();

      expect(snapshot.activeCalendar?.id).toBe('cal-1'); // First in list
      expect(snapshot.isGlobalDefault).toBe(false);
      expect(snapshot.wasAutoSelected).toBe(true);
    });

    it('should return null when no calendars exist', async () => {
      const snapshot = await gateway.loadSnapshot();

      expect(snapshot.activeCalendar).toBeNull();
    });
  });

  describe('Deletion and Cleanup', () => {
    it('should clean up travel defaults when calendar is deleted', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setTravelDefault('travel-1', 'cal-2');
      await calendarRepo.setTravelDefault('travel-2', 'cal-2');

      expect(await calendarRepo.getTravelDefault('travel-1')).toBe('cal-2');
      expect(await calendarRepo.getTravelDefault('travel-2')).toBe('cal-2');

      // Delete calendar
      await calendarRepo.deleteCalendar('cal-2');

      // Travel defaults should be cleared
      expect(await calendarRepo.getTravelDefault('travel-1')).toBeNull();
      expect(await calendarRepo.getTravelDefault('travel-2')).toBeNull();
    });

    it('should resolve to fallback when deleted calendar was global default', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');

      // Delete default calendar
      await calendarRepo.deleteCalendar('cal-1');

      // Should auto-select remaining calendar
      const snapshot = await gateway.loadSnapshot();

      expect(snapshot.activeCalendar?.id).toBe('cal-2');
      expect(snapshot.wasAutoSelected).toBe(true);
    });
  });

  describe('StateSnapshot Integration', () => {
    it('should include default calendar info in snapshot', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');

      const snapshot = await gateway.loadSnapshot();

      expect(snapshot.defaultCalendarId).toBe('cal-1');
      expect(snapshot.isGlobalDefault).toBe(true);
      expect(snapshot.wasAutoSelected).toBe(false);
    });

    it('should show wasAutoSelected when using fallback', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      const snapshot = await gateway.loadSnapshot();

      expect(snapshot.defaultCalendarId).toBeNull();
      expect(snapshot.isGlobalDefault).toBe(false);
      expect(snapshot.wasAutoSelected).toBe(true);
      expect(snapshot.activeCalendar?.id).toBe('cal-1');
    });

    it('should respect travel default in snapshot', async () => {
      await calendarRepo.createCalendar(calendar1);
      await calendarRepo.createCalendar(calendar2);

      await calendarRepo.setGlobalDefault('cal-1');
      await calendarRepo.setTravelDefault('travel-1', 'cal-2');

      const snapshot = await gateway.loadSnapshot({ travelId: 'travel-1' });

      expect(snapshot.defaultCalendarId).toBeNull();
      expect(snapshot.isGlobalDefault).toBe(false);
      expect(snapshot.wasAutoSelected).toBe(false);
      expect(snapshot.travelDefaultCalendarId).toBe('cal-2');
      expect(snapshot.activeCalendar?.id).toBe('cal-2');
    });
  });
});
