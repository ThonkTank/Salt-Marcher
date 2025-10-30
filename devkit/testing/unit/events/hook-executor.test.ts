// devkit/testing/unit/events/hook-executor.test.ts
// Unit tests for Hook Executor

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HookExecutor } from "../../../../src/features/events/hook-executor";
import type { HookHandler, HookExecutionContext } from "../../../../src/features/events/hook-executor";
import type { HookDescriptor, CalendarEvent } from "../../../../src/workmodes/almanac/domain";

// Mock handler for testing
class MockHandler implements HookHandler {
    readonly type = "test";
    executeCalls: Array<{ descriptor: HookDescriptor; context: HookExecutionContext }> = [];

    canHandle(descriptor: HookDescriptor): boolean {
        return descriptor.type === this.type;
    }

    async execute(descriptor: HookDescriptor, context: HookExecutionContext): Promise<void> {
        this.executeCalls.push({ descriptor, context });
    }

    reset(): void {
        this.executeCalls = [];
    }
}

describe("HookExecutor", () => {
    let executor: HookExecutor;
    let mockHandler: MockHandler;

    beforeEach(() => {
        executor = new HookExecutor();
        mockHandler = new MockHandler();
        executor.registerHandler(mockHandler);
    });

    describe("registerHandler", () => {
        it("registers a hook handler", () => {
            const handler = new MockHandler();
            expect(() => executor.registerHandler(handler)).not.toThrow();
        });
    });

    describe("executeHooks", () => {
        it("executes hooks from events", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [
                    {
                        id: "hook-1",
                        type: "test",
                        config: { message: "Hello" },
                    },
                ],
            };

            await executor.executeHooks([event], [], {
                scope: "global",
                reason: "advance",
            });

            expect(mockHandler.executeCalls).toHaveLength(1);
            expect(mockHandler.executeCalls[0].descriptor.id).toBe("hook-1");
            expect(mockHandler.executeCalls[0].context.event).toBe(event);
        });

        it("executes multiple hooks from single event", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [
                    { id: "hook-1", type: "test", config: {} },
                    { id: "hook-2", type: "test", config: {} },
                ],
            };

            await executor.executeHooks([event], [], {
                scope: "global",
                reason: "advance",
            });

            expect(mockHandler.executeCalls).toHaveLength(2);
        });

        it("executes hooks from multiple events", async () => {
            const event1: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Event 1",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [{ id: "hook-1", type: "test", config: {} }],
            };

            const event2: CalendarEvent = {
                kind: "single",
                id: "evt-2",
                calendarId: "cal-1",
                title: "Event 2",
                date: { year: 2025, monthId: "jan", day: 2 },
                allDay: true,
                timePrecision: "day",
                hooks: [{ id: "hook-2", type: "test", config: {} }],
            };

            await executor.executeHooks([event1, event2], [], {
                scope: "global",
                reason: "advance",
            });

            expect(mockHandler.executeCalls).toHaveLength(2);
        });

        it("skips events without hooks", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Event Without Hooks",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                // No hooks
            };

            await executor.executeHooks([event], [], {
                scope: "global",
                reason: "advance",
            });

            expect(mockHandler.executeCalls).toHaveLength(0);
        });

        it("skips hooks with no registered handler", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [
                    { id: "hook-1", type: "unknown_type", config: {} },
                ],
            };

            await executor.executeHooks([event], [], {
                scope: "global",
                reason: "advance",
            });

            expect(mockHandler.executeCalls).toHaveLength(0);
        });

        it("continues execution if one hook fails", async () => {
            const failingHandler: HookHandler = {
                type: "failing",
                canHandle: () => true,
                execute: async () => {
                    throw new Error("Handler failed");
                },
            };

            executor.registerHandler(failingHandler);

            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [
                    { id: "hook-1", type: "failing", config: {} },
                    { id: "hook-2", type: "test", config: {} },
                ],
            };

            await executor.executeHooks([event], [], {
                scope: "global",
                reason: "advance",
            });

            // Should still execute the second hook despite first one failing
            expect(mockHandler.executeCalls).toHaveLength(1);
            expect(mockHandler.executeCalls[0].descriptor.id).toBe("hook-2");
        });

        it("passes context correctly", async () => {
            const event: CalendarEvent = {
                kind: "single",
                id: "evt-1",
                calendarId: "cal-1",
                title: "Test Event",
                date: { year: 2025, monthId: "jan", day: 1 },
                allDay: true,
                timePrecision: "day",
                hooks: [{ id: "hook-1", type: "test", config: {} }],
            };

            await executor.executeHooks([event], [], {
                scope: "travel",
                travelId: "travel-123",
                reason: "jump",
            });

            const context = mockHandler.executeCalls[0].context;
            expect(context.scope).toBe("travel");
            expect(context.travelId).toBe("travel-123");
            expect(context.reason).toBe("jump");
        });
    });
});
