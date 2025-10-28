// salt-marcher/tests/app/integration-telemetry.test.ts
// Prueft, dass Integrationsfehler dedupliziert und zuruecksetzbar sind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noticeMocks = vi.hoisted(() => {
    const noticeSpy = vi.fn();
    const mockNotice = vi.fn(function (this: unknown, message: string) {
        noticeSpy(message);
        void this;
    });
    return { noticeSpy, mockNotice };
});

const { noticeSpy, mockNotice } = noticeMocks;

vi.mock("obsidian", () => ({
    Notice: noticeMocks.mockNotice,
}));

import { __resetIntegrationIssueTelemetry, reportIntegrationIssue } from "../../src/app/integration-telemetry";

describe("integration telemetry", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        __resetIntegrationIssueTelemetry();
        noticeSpy.mockClear();
        mockNotice.mockClear();
        consoleError = vi.spyOn(console, "error").mockImplementation(() => {
            /* muted for tests */
        });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it("deduplicates notices per integration operation", () => {
        // Arrange
        const payload = {
            integrationId: "obsidian:cartographer-view",
            operation: "activate-view" as const,
            error: new Error("activate failed"),
            userMessage: "Cartographer konnte nicht geoeffnet werden.",
        };

        // Act
        reportIntegrationIssue(payload);
        reportIntegrationIssue(payload);

        // Assert
        expect(consoleError).toHaveBeenCalledTimes(2);
        expect(consoleError).toHaveBeenCalledWith(
            "[salt-marcher] integration(obsidian:cartographer-view) activate-view failed",
            payload.error,
        );
        expect(noticeSpy).toHaveBeenCalledTimes(1);
        expect(noticeSpy).toHaveBeenCalledWith("Cartographer konnte nicht geoeffnet werden.");
    });

    it("resets deduplication state when requested", () => {
        // Arrange
        const payload = {
            integrationId: "obsidian:library-view",
            operation: "activate-view" as const,
            error: new Error("open failed"),
            userMessage: "Library konnte nicht geoeffnet werden.",
        };

        // Act
        reportIntegrationIssue(payload);
        __resetIntegrationIssueTelemetry();
        reportIntegrationIssue(payload);

        // Assert
        expect(noticeSpy).toHaveBeenCalledTimes(2);
    });
});
