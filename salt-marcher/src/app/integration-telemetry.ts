import { Notice } from "obsidian";

/** Identifies the bridge/integration that surfaced an operational issue. */
export type IntegrationId = string;

/** Supported failure modes emitted by layout/editor style integrations. */
export type IntegrationOperation =
    | "resolve-api"
    | "register-view-binding"
    | "unregister-view-binding";

export interface IntegrationIssuePayload {
    /** Stable integration identifier (e.g. the external plugin id). */
    integrationId: IntegrationId;
    /** The failing operation within the integration lifecycle. */
    operation: IntegrationOperation;
    /** Captured error/exception for diagnostic logging. */
    error: unknown;
    /** User-facing explanation shown as an Obsidian notice. */
    userMessage: string;
}

const notifiedOperations = new Set<string>();

/**
 * Reports integration issues to both the developer console and the user.
 * Repeated failures for the same integration & operation are deduplicated
 * to avoid notice spam.
 */
export function reportIntegrationIssue(payload: IntegrationIssuePayload): void {
    const { integrationId, operation, error, userMessage } = payload;
    const logPrefix = `[salt-marcher] integration(${integrationId}) ${operation} failed`;
    console.error(logPrefix, error);

    const dedupeKey = `${integrationId}:${operation}`;
    if (notifiedOperations.has(dedupeKey)) return;
    notifiedOperations.add(dedupeKey);

    new Notice(userMessage);
}

/** @internal - Test hook to clear deduplicated notice state. */
export function __resetIntegrationIssueTelemetry(): void {
    notifiedOperations.clear();
}
