// devkit/testing/unit/dungeons/token-creation-modal.test.ts
// Unit tests for TokenCreationModal

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenCreationModal } from "../../../../src/features/dungeons/ui/token-creation-modal";
import type { TokenCreationData } from "../../../../src/features/dungeons/ui/token-creation-modal";

// Mock Obsidian App and Modal
const mockApp = {
    workspace: {},
    vault: {},
} as any;

describe("TokenCreationModal", () => {
    describe("Create Mode", () => {
        it("creates modal without initial data", () => {
            const onSubmit = vi.fn();
            const modal = new TokenCreationModal(mockApp, onSubmit);

            expect(modal).toBeDefined();
        });

        it("initializes with default values", () => {
            const onSubmit = vi.fn();
            const modal = new TokenCreationModal(mockApp, onSubmit);

            // Access private fields through type assertion for testing
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("player");
            expect(privateModal.tokenLabel).toBe("");
            expect(privateModal.tokenColor).toBe("");
            expect(privateModal.tokenSize).toBe(1.0);
            expect(privateModal.isEditMode).toBe(false);
        });
    });

    describe("Edit Mode", () => {
        it("creates modal with initial data", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "monster",
                label: "Goblin",
                color: "#ff0000",
                size: 0.8,
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);

            expect(modal).toBeDefined();
        });

        it("pre-fills form with initial data", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "monster",
                label: "Goblin",
                color: "#ff0000",
                size: 0.8,
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);

            // Access private fields through type assertion for testing
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("monster");
            expect(privateModal.tokenLabel).toBe("Goblin");
            expect(privateModal.tokenColor).toBe("#ff0000");
            expect(privateModal.tokenSize).toBe(0.8);
            expect(privateModal.isEditMode).toBe(true);
        });

        it("handles optional fields in initial data", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "npc",
                label: "Guard",
                // color and size are optional
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);

            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("npc");
            expect(privateModal.tokenLabel).toBe("Guard");
            expect(privateModal.tokenColor).toBe(""); // Should default to empty
            expect(privateModal.tokenSize).toBe(1.0); // Should default to 1.0
            expect(privateModal.isEditMode).toBe(true);
        });
    });

    describe("Token Types", () => {
        it("supports player token type", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "player",
                label: "Gandalf",
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("player");
        });

        it("supports npc token type", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "npc",
                label: "Shopkeeper",
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("npc");
        });

        it("supports monster token type", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "monster",
                label: "Dragon",
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("monster");
        });

        it("supports object token type", () => {
            const onSubmit = vi.fn();
            const initialData: TokenCreationData = {
                type: "object",
                label: "Chest",
            };

            const modal = new TokenCreationModal(mockApp, onSubmit, initialData);
            const privateModal = modal as any;

            expect(privateModal.tokenType).toBe("object");
        });
    });
});
