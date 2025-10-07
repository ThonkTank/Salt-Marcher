// src/apps/almanac/telemetry.ts
// Central telemetry helpers for Almanac events and data layer diagnostics.

import { reportIntegrationIssue } from "../../app/integration-telemetry";
import type { AlmanacMode, TravelCalendarMode } from "./mode/contracts";
import type { CalendarTimestamp } from "./domain/calendar-timestamp";

/** Stable integration identifier used for Almanac notices. */
export const ALMANAC_INTEGRATION_ID = "obsidian:almanac-view" as const;

export type AlmanacTelemetryEvent =
  | {
      readonly type: "calendar.time.advance";
      readonly scope: "global" | "travel";
      readonly reason: "advance" | "jump";
      readonly unit: "day" | "hour" | "minute";
      readonly amount: number;
      readonly triggeredEvents: number;
      readonly triggeredPhenomena: number;
      readonly skippedEvents: number;
      readonly travelId?: string | null;
      readonly timestamp: CalendarTimestamp | null;
    }
  | {
      readonly type: "calendar.default.change";
      readonly scope: "global" | "travel";
      readonly calendarId: string;
      readonly previousDefaultId: string | null;
      readonly travelId?: string | null;
      readonly wasAutoSelected?: boolean;
    }
  | {
      readonly type: "calendar.almanac.mode_change";
      readonly mode: AlmanacMode;
      readonly previousMode: AlmanacMode;
      readonly history: ReadonlyArray<AlmanacMode>;
    }
  | {
      readonly type: "calendar.travel.lifecycle";
      readonly phase: "mount" | "mode-change" | "visibility";
      readonly travelId: string | null;
      readonly visible: boolean;
      readonly mode: TravelCalendarMode;
      readonly timestamp: CalendarTimestamp | null;
    }
  | {
      readonly type: "calendar.event.conflict";
      readonly code: "default" | "phenomenon" | "event";
      readonly message: string;
      readonly context?: Record<string, unknown>;
    };

type AlmanacTelemetryReporter = (event: AlmanacTelemetryEvent) => void;

const defaultReporter: AlmanacTelemetryReporter = event => {
  const { type, ...payload } = event;
  // eslint-disable-next-line no-console -- Observability hook for development builds.
  console.info("[almanac:telemetry]", type, payload);
};

let reporter: AlmanacTelemetryReporter = defaultReporter;

/** Emits a structured telemetry event for Almanac state changes. */
export function emitAlmanacEvent(event: AlmanacTelemetryEvent): void {
  reporter(event);
}

/** Overrides the telemetry reporter (mainly used in tests). */
export function setAlmanacTelemetryReporter(next: AlmanacTelemetryReporter | null): void {
  reporter = next ?? defaultReporter;
}

/** Resets the telemetry reporter to the default console logger. */
export function resetAlmanacTelemetryReporter(): void {
  reporter = defaultReporter;
}

export type AlmanacGatewayIssueCode = "io_error" | "validation_error" | "conflict" | "phenomenon_conflict";

export interface AlmanacGatewayIssuePayload {
  readonly operation: string;
  readonly scope: "calendar" | "event" | "phenomenon" | "default" | "travel";
  readonly code: AlmanacGatewayIssueCode;
  readonly error: unknown;
  readonly context?: Record<string, unknown>;
  readonly userMessage?: string;
}

const DEFAULT_USER_MESSAGES: Record<AlmanacGatewayIssueCode, string> = {
  io_error: "The Almanac data store is currently unavailable. Please check the developer console for details.",
  validation_error: "The Almanac input could not be validated. Please review the provided data and try again.",
  conflict: "The Almanac detected a conflicting calendar configuration.",
  phenomenon_conflict: "The phenomenon cannot be linked because it conflicts with existing calendar rules.",
};

/** Logs gateway/repository failures and forwards io errors to the integration telemetry. */
export function reportAlmanacGatewayIssue(payload: AlmanacGatewayIssuePayload): void {
  const { operation, scope, code, error } = payload;
  const userMessage = payload.userMessage ?? DEFAULT_USER_MESSAGES[code];
  const logContext = { scope, code, ...(payload.context ?? {}) };

  // eslint-disable-next-line no-console -- Observability hook for runtime diagnostics.
  console.error(`[almanac] ${operation} failed`, logContext, error);

  if (code === "io_error") {
    reportIntegrationIssue({
      integrationId: ALMANAC_INTEGRATION_ID,
      operation: "prime-dataset",
      error,
      userMessage,
    });
  }
}
