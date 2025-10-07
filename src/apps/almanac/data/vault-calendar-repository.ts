// src/apps/almanac/data/vault-calendar-repository.ts
// Vault-backed calendar repository with schema versioning and default handling.

import type { CalendarSchemaDTO } from "./dto";
import {
  type CalendarDefaultSnapshot,
  type CalendarDefaultsRepository,
  type CalendarRepository,
  type CalendarDefaultUpdate,
} from "./calendar-repository";
import { JsonStore } from "./json-store";
import type { VaultLike, VersionedPayload } from "./json-store";
import { reportAlmanacGatewayIssue } from "../telemetry";

interface CalendarStoreData {
  readonly calendars: CalendarSchemaDTO[];
  readonly defaults: CalendarDefaultSnapshot;
}

const CALENDAR_STORE_VERSION = "1.4.0";
const CALENDAR_STORE_PATH = "SaltMarcher/Almanac/calendars.json";

export class VaultCalendarRepository implements CalendarRepository, CalendarDefaultsRepository {
  private readonly store: JsonStore<CalendarStoreData>;

  constructor(vault: VaultLike) {
    this.store = new JsonStore<CalendarStoreData>(vault, {
      path: CALENDAR_STORE_PATH,
      currentVersion: CALENDAR_STORE_VERSION,
      initialData: () => ({ calendars: [], defaults: { global: null, travel: {} } }),
      migrations: {
        "0.0.0": payload => migrateLegacyCalendars(payload),
      },
    });
  }

  async listCalendars(): Promise<ReadonlyArray<CalendarSchemaDTO>> {
    const { calendars, defaults } = await this.store.read();
    return calendars.map(calendar => ({
      ...calendar,
      isDefaultGlobal: defaults.global === calendar.id,
      defaultTravelIds: computeDefaultTravelIds(calendar.id, defaults.travel),
    }));
  }

  async getCalendar(id: string): Promise<CalendarSchemaDTO | null> {
    const { calendars, defaults } = await this.store.read();
    const calendar = calendars.find(entry => entry.id === id);
    if (!calendar) {
      return null;
    }
    return {
      ...calendar,
      isDefaultGlobal: defaults.global === calendar.id,
      defaultTravelIds: computeDefaultTravelIds(calendar.id, defaults.travel),
    };
  }

  async createCalendar(input: CalendarSchemaDTO & { readonly isDefaultGlobal?: boolean }): Promise<void> {
    try {
      await this.store.update(state => {
        if (state.calendars.some(calendar => calendar.id === input.id)) {
          throw new Error(`Calendar with ID ${input.id} already exists`);
        }
        const calendars = [...state.calendars, { ...input }];
        const defaults = ensureDefaultsState(state.defaults);
        if (input.isDefaultGlobal) {
          defaults.global = input.id;
        }
        return { calendars, defaults };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "calendar.repository.createCalendar",
        scope: "calendar",
        code: isCalendarRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { calendarId: input.id },
      });
      throw error;
    }
  }

  async updateCalendar(id: string, input: Partial<CalendarSchemaDTO>): Promise<void> {
    try {
      await this.store.update(state => {
        const index = state.calendars.findIndex(calendar => calendar.id === id);
        if (index === -1) {
          throw new Error(`Calendar with ID ${id} not found`);
        }
        const calendars = [...state.calendars];
        calendars[index] = { ...calendars[index], ...input };
        return { calendars, defaults: ensureDefaultsState(state.defaults) };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "calendar.repository.updateCalendar",
        scope: "calendar",
        code: isCalendarRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { calendarId: id },
      });
      throw error;
    }
  }

  async deleteCalendar(id: string): Promise<void> {
    try {
      await this.store.update(state => {
        if (!state.calendars.some(calendar => calendar.id === id)) {
          throw new Error(`Calendar with ID ${id} not found`);
        }
        const calendars = state.calendars.filter(calendar => calendar.id !== id);
        const defaults = ensureDefaultsState(state.defaults);
        if (defaults.global === id) {
          defaults.global = null;
        }
        const travelEntries = Object.entries(defaults.travel);
        for (const [travelId, calendarId] of travelEntries) {
          if (calendarId === id) {
            defaults.travel[travelId] = null;
          }
        }
        return { calendars, defaults };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "calendar.repository.deleteCalendar",
        scope: "calendar",
        code: isCalendarRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { calendarId: id },
      });
      throw error;
    }
  }

  async setDefault(input: CalendarDefaultUpdate): Promise<void> {
    try {
      await this.store.update(state => {
        if (!state.calendars.some(calendar => calendar.id === input.calendarId)) {
          throw new Error(`Calendar with ID ${input.calendarId} not found`);
        }
        const defaults = ensureDefaultsState(state.defaults);
        if (input.scope === "global") {
          defaults.global = input.calendarId;
        } else if (input.scope === "travel" && input.travelId) {
          defaults.travel[input.travelId] = input.calendarId;
        }
        return { calendars: state.calendars, defaults };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "calendar.repository.setDefault",
        scope: input.scope === "travel" ? "travel" : "default",
        code: isCalendarRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { calendarId: input.calendarId, travelId: input.travelId ?? null },
      });
      throw error;
    }
  }

  async getDefaults(): Promise<CalendarDefaultSnapshot> {
    const { defaults } = await this.store.read();
    return ensureDefaultsState(defaults);
  }

  async getGlobalDefault(): Promise<string | null> {
    const { defaults } = await this.store.read();
    return ensureDefaultsState(defaults).global;
  }

  async getTravelDefault(travelId: string): Promise<string | null> {
    const { defaults } = await this.store.read();
    const snapshot = ensureDefaultsState(defaults);
    return snapshot.travel[travelId] ?? null;
  }

  async clearTravelDefault(travelId: string): Promise<void> {
    try {
      await this.store.update(state => {
        const defaults = ensureDefaultsState(state.defaults);
        if (defaults.travel[travelId]) {
          defaults.travel[travelId] = null;
        }
        return { calendars: state.calendars, defaults };
      });
    } catch (error) {
      reportAlmanacGatewayIssue({
        operation: "calendar.repository.clearTravelDefault",
        scope: "travel",
        code: isCalendarRepositoryValidationError(error) ? "validation_error" : "io_error",
        error,
        context: { travelId },
      });
      throw error;
    }
  }
}

function ensureDefaultsState(snapshot: CalendarDefaultSnapshot | undefined): CalendarDefaultSnapshot {
  return {
    global: snapshot?.global ?? null,
    travel: { ...(snapshot?.travel ?? {}) },
  };
}

function computeDefaultTravelIds(calendarId: string, travel: Readonly<Record<string, string | null>>): string[] {
  return Object.entries(travel)
    .filter(([, linkedId]) => linkedId === calendarId)
    .map(([travelId]) => travelId);
}

function migrateLegacyCalendars(payload: VersionedPayload<CalendarStoreData>): VersionedPayload<CalendarStoreData> {
  const defaults = ensureDefaultsState(payload.data.defaults);
  return {
    version: CALENDAR_STORE_VERSION,
    data: {
      calendars: payload.data.calendars ?? [],
      defaults,
    },
  };
}

function isCalendarRepositoryValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /already exists|not found|required/i.test(error.message);
}
