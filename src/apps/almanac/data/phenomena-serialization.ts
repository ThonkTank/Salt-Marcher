// src/apps/almanac/data/phenomena-serialization.ts
// Helpers for serialising and parsing Almanac phenomena import/export payloads.

import type { PhenomenonDTO } from "./dto";

type MinimalPhenomenon = Pick<
  PhenomenonDTO,
  | "id"
  | "name"
  | "category"
  | "visibility"
  | "appliesToCalendarIds"
  | "rule"
  | "timePolicy"
  | "priority"
  | "schemaVersion"
> &
  Partial<Pick<PhenomenonDTO, "notes" | "tags" | "effects" | "hooks" | "startTime" | "offsetMinutes" | "durationMinutes">>;

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value;
}

function assertArray(value: unknown, path: string): ReadonlyArray<unknown> {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function normalisePhenomenon(input: unknown, index: number): PhenomenonDTO {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Entry ${index + 1} must be an object`);
  }
  const record = input as Record<string, unknown>;
  const id = assertString(record.id, `phenomena[${index}].id`).trim();
  const name = assertString(record.name, `phenomena[${index}].name`).trim();
  const category = assertString(record.category ?? "custom", `phenomena[${index}].category`).trim();
  const visibility = assertString(
    record.visibility ?? "all_calendars",
    `phenomena[${index}].visibility`,
  ) as PhenomenonDTO["visibility"];
  const appliesTo = assertArray(
    record.appliesToCalendarIds ?? [],
    `phenomena[${index}].appliesToCalendarIds`,
  ).map(value => assertString(value, `phenomena[${index}].appliesToCalendarIds[]`));

  const rule = (record.rule ?? { type: "annual", offsetDayOfYear: 0 }) as PhenomenonDTO["rule"];
  const timePolicy = (record.timePolicy ?? "all_day") as PhenomenonDTO["timePolicy"];
  const priority = typeof record.priority === "number" ? record.priority : 0;
  const schemaVersion = assertString(
    record.schemaVersion ?? "1.0.0",
    `phenomena[${index}].schemaVersion`,
  );

  const base: MinimalPhenomenon = {
    id,
    name,
    category: category || "custom",
    visibility: visibility === "selected" ? "selected" : "all_calendars",
    appliesToCalendarIds: appliesTo,
    rule,
    timePolicy,
    priority,
    schemaVersion,
  };

  const optionalKeys: Array<keyof PhenomenonDTO> = [
    "notes",
    "tags",
    "effects",
    "hooks",
    "startTime",
    "offsetMinutes",
    "durationMinutes",
  ];

  for (const key of optionalKeys) {
    if (record[key] !== undefined) {
      (base as Record<string, unknown>)[key] = record[key];
    }
  }

  return base as PhenomenonDTO;
}

/**
 * Parses a JSON payload describing phenomena and returns DTOs for repository import.
 */
export function parsePhenomenaImport(source: string): ReadonlyArray<PhenomenonDTO> {
  const trimmed = source.trim();
  if (!trimmed) {
    return [];
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Import payload is not valid JSON: ${message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("Import payload must be a JSON array");
  }

  return data.map((entry, index) => normalisePhenomenon(entry, index));
}

/**
 * Formats the provided phenomena as a prettified JSON string for export.
 */
export function formatPhenomenaExport(entries: ReadonlyArray<PhenomenonDTO>): string {
  const payload = entries.map(entry => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    visibility: entry.visibility,
    appliesToCalendarIds: entry.appliesToCalendarIds,
    rule: entry.rule,
    timePolicy: entry.timePolicy,
    priority: entry.priority,
    schemaVersion: entry.schemaVersion,
    notes: entry.notes,
    tags: entry.tags,
    effects: entry.effects,
    hooks: entry.hooks,
    startTime: entry.startTime,
    offsetMinutes: entry.offsetMinutes,
    durationMinutes: entry.durationMinutes,
  }));

  return JSON.stringify(payload, null, 2);
}
