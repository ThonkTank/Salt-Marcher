// devkit/testing/unit/events/faction-location-handlers.test.ts
// Unit tests for Faction and Location Handlers

import { describe, it, expect } from "vitest";
import { FactionHandler } from "../../../../src/features/events/hooks/faction-handler";
import { LocationHandler } from "../../../../src/features/events/hooks/location-handler";
import type { HookDescriptor } from "../../../../src/workmodes/almanac/domain";
import type { HookExecutionContext } from "../../../../src/features/events/hook-executor";

describe("FactionHandler", () => {
    const handler = new FactionHandler();

    describe("canHandle", () => {
        it("accepts valid faction_update descriptors", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Goblins",
                    action: "set_status",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(true);
        });

        it("rejects descriptors with wrong type", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "notification",
                config: {
                    factionName: "Goblins",
                    action: "set_status",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });

        it("rejects descriptors without factionName", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    action: "set_status",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });

        it("rejects descriptors without action", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Goblins",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });
    });

    describe("execute", () => {
        const mockContext: HookExecutionContext = {
            scope: "global",
            reason: "advance",
        };

        it("executes set_status action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Goblins",
                    action: "set_status",
                    status: "at_war",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("executes change_relationship action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Kingdom",
                    action: "change_relationship",
                    targetFaction: "Goblins",
                    relationshipValue: -50,
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("executes update_resources action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Kingdom",
                    action: "update_resources",
                    resources: { gold: 1000, food: 500 },
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("handles unknown action gracefully", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "faction_update",
                config: {
                    factionName: "Kingdom",
                    action: "unknown_action",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });
    });
});

describe("LocationHandler", () => {
    const handler = new LocationHandler();

    describe("canHandle", () => {
        it("accepts valid location_update descriptors", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Saltmarsh Harbor",
                    action: "set_state",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(true);
        });

        it("rejects descriptors with wrong type", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "notification",
                config: {
                    locationName: "Harbor",
                    action: "set_state",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });

        it("rejects descriptors without locationName", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    action: "set_state",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });

        it("rejects descriptors without action", () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Harbor",
                },
            };

            expect(handler.canHandle(descriptor)).toBe(false);
        });
    });

    describe("execute", () => {
        const mockContext: HookExecutionContext = {
            scope: "global",
            reason: "advance",
        };

        it("executes set_state action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Harbor",
                    action: "set_state",
                    state: "occupied",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("executes change_owner action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Old Keep",
                    action: "change_owner",
                    ownerFaction: "Goblins",
                    ownerType: "faction",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("executes update_description action without throwing", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Harbor",
                    action: "update_description",
                    description: "The harbor is now bustling with activity.",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });

        it("handles unknown action gracefully", async () => {
            const descriptor: HookDescriptor = {
                id: "hook-1",
                type: "location_update",
                config: {
                    locationName: "Harbor",
                    action: "unknown_action",
                },
            };

            await expect(handler.execute(descriptor, mockContext)).resolves.not.toThrow();
        });
    });
});
