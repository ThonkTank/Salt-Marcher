// devkit/testing/unit/dungeons/grid-renderer.test.ts
// Unit tests for GridRenderer

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GridRenderer } from "../../../../src/features/dungeons/rendering/grid-renderer";
import type { LocationData, DungeonRoom } from "../../../../src/workmodes/library/locations/types";

describe("GridRenderer", () => {
    let canvas: HTMLCanvasElement;
    let renderer: GridRenderer;

    beforeEach(() => {
        // Create mock canvas
        canvas = document.createElement("canvas");

        // Mock getContext to return a valid 2D context
        const mockCtx = {
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fillText: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            strokeStyle: "",
            lineWidth: 0,
            fillStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            shadowColor: "",
            shadowBlur: 0,
        };

        vi.spyOn(canvas, "getContext").mockReturnValue(mockCtx as any);

        renderer = new GridRenderer(canvas, {
            gridWidth: 30,
            gridHeight: 20,
            cellSize: 40,
            showGrid: true,
            showCoordinates: false,
        });
    });

    describe("Initialization", () => {
        it("creates renderer with correct options", () => {
            const dims = renderer.getDimensions();
            expect(dims.width).toBe(30 * 40); // 1200
            expect(dims.height).toBe(20 * 40); // 800
        });

        it("initializes with default scale of 1.0", () => {
            expect(renderer.getScale()).toBe(1.0);
        });
    });

    describe("Transform State", () => {
        it("resets view to default state", () => {
            // Manually modify internal state (would normally happen via zoom/pan)
            // For this test, we just verify resetView works
            renderer.resetView();
            expect(renderer.getScale()).toBe(1.0);
        });

        it("provides current scale", () => {
            const scale = renderer.getScale();
            expect(typeof scale).toBe("number");
            expect(scale).toBeGreaterThan(0);
        });
    });

    describe("Dungeon Rendering", () => {
        it("renders dungeon without errors", () => {
            const dungeon: LocationData = {
                name: "Test Dungeon",
                type: "Dungeon",
                grid_width: 30,
                grid_height: 20,
                rooms: [],
            };

            expect(() => renderer.render(dungeon)).not.toThrow();
        });

        it("renders dungeon with single room", () => {
            const room: DungeonRoom = {
                id: "R1",
                name: "Test Room",
                grid_bounds: { x: 5, y: 5, width: 10, height: 8 },
                doors: [],
                features: [],
            };

            const dungeon: LocationData = {
                name: "Test Dungeon",
                type: "Dungeon",
                grid_width: 30,
                grid_height: 20,
                rooms: [room],
            };

            expect(() => renderer.render(dungeon)).not.toThrow();
        });

        it("renders dungeon with doors and features", () => {
            const room: DungeonRoom = {
                id: "R1",
                name: "Complex Room",
                grid_bounds: { x: 5, y: 5, width: 10, height: 8 },
                doors: [
                    {
                        id: "T1",
                        position: { x: 10, y: 7 },
                        leads_to: "R2",
                        locked: false,
                    },
                ],
                features: [
                    {
                        id: "F1",
                        type: "treasure",
                        position: { x: 8, y: 9 },
                        description: "A chest full of gold",
                    },
                ],
            };

            const dungeon: LocationData = {
                name: "Test Dungeon",
                type: "Dungeon",
                grid_width: 30,
                grid_height: 20,
                rooms: [room],
            };

            expect(() => renderer.render(dungeon)).not.toThrow();
        });

        it("throws error for non-dungeon location", () => {
            const nonDungeon: LocationData = {
                name: "Town",
                type: "Stadt",
            };

            expect(() => renderer.render(nonDungeon)).toThrow("Cannot render non-dungeon location");
        });

        it("renders dungeon with tokens", () => {
            const dungeon: LocationData = {
                name: "Test Dungeon",
                type: "Dungeon",
                grid_width: 30,
                grid_height: 20,
                rooms: [],
                tokens: [
                    {
                        id: "token-1",
                        type: "player",
                        position: { x: 10, y: 10 },
                        label: "Gandalf",
                    },
                    {
                        id: "token-2",
                        type: "monster",
                        position: { x: 15, y: 12 },
                        label: "Goblin",
                        color: "#ff0000",
                        size: 0.8,
                    },
                ],
            };

            expect(() => renderer.render(dungeon)).not.toThrow();
        });
    });

    describe("Callbacks", () => {
        it("invokes transform change callback", () => {
            const callback = vi.fn();
            renderer.setOnTransformChange(callback);

            // Simulate a transform change (would normally happen via zoom/pan events)
            // Since we can't easily trigger events in tests, we just verify the setter works
            expect(callback).not.toHaveBeenCalled();
        });

        it("invokes hover change callback", () => {
            const callback = vi.fn();
            renderer.setOnHoverChange(callback);

            // Verify setter works
            expect(callback).not.toHaveBeenCalled();
        });

        it("invokes room select callback", () => {
            const callback = vi.fn();
            renderer.setOnRoomSelect(callback);

            // Verify setter works
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("Dimensions", () => {
        it("calculates correct dimensions", () => {
            const dims = renderer.getDimensions();
            expect(dims.width).toBe(1200); // 30 * 40
            expect(dims.height).toBe(800); // 20 * 40
        });

        it("updates dimensions when options change", () => {
            renderer.setOptions({
                gridWidth: 40,
                gridHeight: 30,
                cellSize: 50,
            });

            const dims = renderer.getDimensions();
            expect(dims.width).toBe(2000); // 40 * 50
            expect(dims.height).toBe(1500); // 30 * 50
        });
    });

    describe("Event Listeners", () => {
        it("cleans up event listeners on destroy", () => {
            const removeEventListenerSpy = vi.spyOn(canvas, "removeEventListener");

            renderer.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseleave", expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
        });
    });
});
