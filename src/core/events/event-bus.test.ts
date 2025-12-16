import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus, type EventBus } from './event-bus';
import { createEvent, newCorrelationId } from './domain-events';
import { now } from '../types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createEventBus();
  });

  function createTestEvent(type: string, payload: unknown = {}) {
    return createEvent(type, payload, {
      correlationId: newCorrelationId(),
      timestamp: now(),
      source: 'test',
    });
  }

  describe('publish/subscribe', () => {
    it('delivers events to subscribers', () => {
      const handler = vi.fn();
      bus.subscribe('test:event', handler);

      const event = createTestEvent('test:event', { value: 42 });
      bus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('does not deliver events to wrong subscribers', () => {
      const handler = vi.fn();
      bus.subscribe('other:event', handler);

      bus.publish(createTestEvent('test:event'));

      expect(handler).not.toHaveBeenCalled();
    });

    it('delivers to multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe('test:event', handler1);
      bus.subscribe('test:event', handler2);

      bus.publish(createTestEvent('test:event'));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('delivers multiple events', () => {
      const handler = vi.fn();
      bus.subscribe('test:event', handler);

      bus.publish(createTestEvent('test:event', { n: 1 }));
      bus.publish(createTestEvent('test:event', { n: 2 }));
      bus.publish(createTestEvent('test:event', { n: 3 }));

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('unsubscribe', () => {
    it('stops receiving events after unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('test:event', handler);

      bus.publish(createTestEvent('test:event'));
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      bus.publish(createTestEvent('test:event'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not affect other subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = bus.subscribe('test:event', handler1);
      bus.subscribe('test:event', handler2);

      unsubscribe1();
      bus.publish(createTestEvent('test:event'));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeAll', () => {
    it('receives all events', () => {
      const handler = vi.fn();
      bus.subscribeAll(handler);

      bus.publish(createTestEvent('event:a'));
      bus.publish(createTestEvent('event:b'));
      bus.publish(createTestEvent('event:c'));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('can be unsubscribed', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribeAll(handler);

      bus.publish(createTestEvent('test:event'));
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      bus.publish(createTestEvent('test:event'));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('global handlers receive events before type handlers', () => {
      const order: string[] = [];
      bus.subscribeAll(() => order.push('global'));
      bus.subscribe('test:event', () => order.push('specific'));

      bus.publish(createTestEvent('test:event'));

      expect(order).toEqual(['global', 'specific']);
    });
  });

  describe('subscriberCount', () => {
    it('returns 0 for no subscribers', () => {
      expect(bus.subscriberCount('test:event')).toBe(0);
    });

    it('returns correct count', () => {
      bus.subscribe('test:event', vi.fn());
      bus.subscribe('test:event', vi.fn());
      bus.subscribe('other:event', vi.fn());

      expect(bus.subscriberCount('test:event')).toBe(2);
      expect(bus.subscriberCount('other:event')).toBe(1);
    });

    it('updates after unsubscribe', () => {
      const unsub = bus.subscribe('test:event', vi.fn());
      expect(bus.subscriberCount('test:event')).toBe(1);

      unsub();
      expect(bus.subscriberCount('test:event')).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all subscriptions', () => {
      const handler = vi.fn();
      bus.subscribe('test:event', handler);
      bus.subscribeAll(vi.fn());

      bus.clear();
      bus.publish(createTestEvent('test:event'));

      expect(handler).not.toHaveBeenCalled();
      expect(bus.subscriberCount('test:event')).toBe(0);
    });
  });

  describe('error handling', () => {
    it('continues delivering events if a handler throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      bus.subscribe('test:event', errorHandler);
      bus.subscribe('test:event', normalHandler);

      // Should not throw
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.publish(createTestEvent('test:event'));
      consoleSpy.mockRestore();

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });

    it('logs errors from handlers', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.subscribe('test:event', () => {
        throw new Error('Test error');
      });

      bus.publish(createTestEvent('test:event'));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('correlationId', () => {
    it('preserves correlationId through event chain', () => {
      const correlationId = newCorrelationId();
      const receivedIds: string[] = [];

      bus.subscribe('step:1', (event) => {
        receivedIds.push(event.correlationId);
        // Simulate chaining by creating next event with same correlationId
        bus.publish(
          createEvent('step:2', {}, {
            correlationId: event.correlationId,
            timestamp: now(),
            source: 'test',
          })
        );
      });

      bus.subscribe('step:2', (event) => {
        receivedIds.push(event.correlationId);
      });

      bus.publish(
        createEvent('step:1', {}, {
          correlationId,
          timestamp: now(),
          source: 'test',
        })
      );

      expect(receivedIds).toEqual([correlationId, correlationId]);
    });
  });
});

describe('domain-events', () => {
  describe('createEvent', () => {
    it('creates event with all required fields', () => {
      const event = createEvent('test:event', { value: 42 }, {
        correlationId: 'corr-123',
        timestamp: 1700000000000 as ReturnType<typeof now>,
        source: 'test-source',
      });

      expect(event).toEqual({
        type: 'test:event',
        payload: { value: 42 },
        correlationId: 'corr-123',
        timestamp: 1700000000000,
        source: 'test-source',
      });
    });
  });

  describe('newCorrelationId', () => {
    it('generates valid UUID', () => {
      const id = newCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique IDs', () => {
      const id1 = newCorrelationId();
      const id2 = newCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });
});
