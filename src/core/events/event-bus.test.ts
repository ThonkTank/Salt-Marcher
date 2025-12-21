import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus, type EventBus } from './event-bus';
import { createEvent, newCorrelationId } from './domain-events';
import { TimeoutError } from './timeout-error';
import { now } from '../types';

describe('[#2719, #2720, #2721, #2722] EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = createEventBus();
  });

  function createTestEvent<T = unknown>(type: string, payload: T = {} as T) {
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

    it('also clears sticky events', () => {
      const event = createTestEvent('test:started', { id: '1' });
      bus.publish(event, { sticky: true });

      bus.clear();

      // Late subscriber should not receive cleared sticky event
      const handler = vi.fn();
      bus.subscribe('test:started', handler, { replay: true });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('sticky events', () => {
    it('stores sticky event', () => {
      const event = createTestEvent('test:started', { id: '1' });

      bus.publish(event, { sticky: true });

      // Verify by subscribing with replay
      const handler = vi.fn();
      bus.subscribe('test:started', handler, { replay: true });

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('replays sticky event to late subscriber', () => {
      const event = createTestEvent('test:started', { id: '1' });

      // Publish first
      bus.publish(event, { sticky: true });

      // Subscribe later with replay
      const handler = vi.fn();
      bus.subscribe('test:started', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('does not replay without replay option', () => {
      bus.publish(createTestEvent('test:started', {}), { sticky: true });

      const handler = vi.fn();
      bus.subscribe('test:started', handler); // No replay option

      expect(handler).not.toHaveBeenCalled();
    });

    it('clears sticky event with clearSticky', () => {
      bus.publish(createTestEvent('test:started', {}), { sticky: true });

      bus.clearSticky('test:started');

      const handler = vi.fn();
      bus.subscribe('test:started', handler, { replay: true });

      expect(handler).not.toHaveBeenCalled();
    });

    it('still delivers new events after replay', () => {
      const event1 = createTestEvent('test:event', { id: '1' });
      const event2 = createTestEvent('test:event', { id: '2' });

      bus.publish(event1, { sticky: true });

      const handler = vi.fn();
      bus.subscribe('test:event', handler, { replay: true });

      bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, event1);
      expect(handler).toHaveBeenNthCalledWith(2, event2);
    });

    it('overwrites previous sticky event of same type', () => {
      const event1 = createTestEvent('test:started', { id: '1' });
      const event2 = createTestEvent('test:started', { id: '2' });

      bus.publish(event1, { sticky: true });
      bus.publish(event2, { sticky: true });

      const handler = vi.fn();
      bus.subscribe('test:started', handler, { replay: true });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event2);
    });

    it('does not replay for different event type', () => {
      bus.publish(createTestEvent('test:started', {}), { sticky: true });

      const handler = vi.fn();
      bus.subscribe('test:other', handler, { replay: true });

      expect(handler).not.toHaveBeenCalled();
    });

    it('handles replay handler errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Replay error');
      });

      bus.publish(createTestEvent('test:started', {}), { sticky: true });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      bus.subscribe('test:started', errorHandler, { replay: true });

      expect(errorHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('supports multiple sticky event types', () => {
      const combatEvent = createTestEvent('combat:started', { combatId: 'c1' });
      const encounterEvent = createTestEvent('encounter:generated', { encounterId: 'e1' });

      bus.publish(combatEvent, { sticky: true });
      bus.publish(encounterEvent, { sticky: true });

      const combatHandler = vi.fn();
      const encounterHandler = vi.fn();

      bus.subscribe('combat:started', combatHandler, { replay: true });
      bus.subscribe('encounter:generated', encounterHandler, { replay: true });

      expect(combatHandler).toHaveBeenCalledWith(combatEvent);
      expect(encounterHandler).toHaveBeenCalledWith(encounterEvent);
    });

    it('clearSticky only clears specified event type', () => {
      bus.publish(createTestEvent('combat:started', {}), { sticky: true });
      bus.publish(createTestEvent('encounter:generated', {}), { sticky: true });

      bus.clearSticky('combat:started');

      const combatHandler = vi.fn();
      const encounterHandler = vi.fn();

      bus.subscribe('combat:started', combatHandler, { replay: true });
      bus.subscribe('encounter:generated', encounterHandler, { replay: true });

      expect(combatHandler).not.toHaveBeenCalled();
      expect(encounterHandler).toHaveBeenCalled();
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

  describe('request', () => {
    it('resolves with response event matching correlationId', async () => {
      // Simulate a responder
      bus.subscribe('test:request', (event) => {
        // Respond with same correlationId
        bus.publish(
          createEvent(
            'test:response',
            { result: 'success' },
            {
              correlationId: event.correlationId,
              timestamp: now(),
              source: 'responder',
            }
          )
        );
      });

      const requestEvent = createTestEvent('test:request', { query: 'hello' });
      const response = await bus.request<{ query: string }, { result: string }>(
        requestEvent,
        'test:response',
        1000
      );

      expect(response.payload.result).toBe('success');
      expect(response.correlationId).toBe(requestEvent.correlationId);
    });

    it('rejects with TimeoutError when no response arrives', async () => {
      const requestEvent = createTestEvent('test:request', { query: 'hello' });

      await expect(
        bus.request(requestEvent, 'test:response', 50) // 50ms timeout
      ).rejects.toThrow(TimeoutError);
    });

    it('includes timeout duration in TimeoutError', async () => {
      const requestEvent = createTestEvent('test:request', {});

      try {
        await bus.request(requestEvent, 'test:response', 50);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(50);
        expect((error as TimeoutError).message).toContain('test:request');
        expect((error as TimeoutError).message).toContain('test:response');
      }
    });

    it('ignores response events with different correlationId', async () => {
      // Set up a responder that responds with WRONG correlationId
      bus.subscribe('test:request', () => {
        bus.publish(
          createEvent(
            'test:response',
            { result: 'wrong' },
            {
              correlationId: newCorrelationId(), // Different correlationId!
              timestamp: now(),
              source: 'responder',
            }
          )
        );
      });

      const requestEvent = createTestEvent('test:request', {});

      // Should timeout because the response has wrong correlationId
      await expect(
        bus.request(requestEvent, 'test:response', 50)
      ).rejects.toThrow(TimeoutError);
    });

    it('accepts first matching response and ignores subsequent ones', async () => {
      const callOrder: string[] = [];

      // Responder that sends multiple responses
      bus.subscribe('test:request', (event) => {
        // First response
        bus.publish(
          createEvent(
            'test:response',
            { result: 'first' },
            {
              correlationId: event.correlationId,
              timestamp: now(),
              source: 'responder',
            }
          )
        );
        callOrder.push('first-sent');

        // Second response (should be ignored)
        setTimeout(() => {
          bus.publish(
            createEvent(
              'test:response',
              { result: 'second' },
              {
                correlationId: event.correlationId,
                timestamp: now(),
                source: 'responder',
              }
            )
          );
          callOrder.push('second-sent');
        }, 10);
      });

      const requestEvent = createTestEvent('test:request', {});
      const response = await bus.request<unknown, { result: string }>(
        requestEvent,
        'test:response',
        1000
      );

      expect(response.payload.result).toBe('first');

      // Wait for second response to be sent
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callOrder).toContain('second-sent');
    });

    it('cleans up subscription after receiving response', async () => {
      bus.subscribe('test:request', (event) => {
        bus.publish(
          createEvent(
            'test:response',
            {},
            {
              correlationId: event.correlationId,
              timestamp: now(),
              source: 'responder',
            }
          )
        );
      });

      const initialCount = bus.subscriberCount('test:response');
      const requestEvent = createTestEvent('test:request', {});

      await bus.request(requestEvent, 'test:response', 1000);

      // Subscription should be cleaned up
      expect(bus.subscriberCount('test:response')).toBe(initialCount);
    });

    it('cleans up subscription after timeout', async () => {
      const initialCount = bus.subscriberCount('test:response');
      const requestEvent = createTestEvent('test:request', {});

      try {
        await bus.request(requestEvent, 'test:response', 50);
      } catch {
        // Expected timeout
      }

      // Subscription should be cleaned up
      expect(bus.subscriberCount('test:response')).toBe(initialCount);
    });

    it('uses default timeout of 5000ms', async () => {
      vi.useFakeTimers();

      const requestEvent = createTestEvent('test:request', {});
      const promise = bus.request(requestEvent, 'test:response');

      // Advance time by 4999ms - should not reject yet
      vi.advanceTimersByTime(4999);

      // Advance remaining 2ms - now should reject
      vi.advanceTimersByTime(2);

      await expect(promise).rejects.toThrow(TimeoutError);

      vi.useRealTimers();
    });
  });
});

describe('[#2706, #2726] domain-events', () => {
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
