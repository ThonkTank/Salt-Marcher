// src/workmodes/almanac/data/index.ts
// Barrel export for almanac data layer components

export * from "./calendar-state-gateway";
export * from "./calendar-state-repository";
export * from "./event-query-service";
export * from "./time-advancement-service";
export * from "./phenomenon-engine";
export * from "./json-store";
export * from "./inbox-state-store";

// Export EventRepository explicitly to avoid conflicts
export { EventRepository } from "./event-repository";
export type { BaseEventRepository } from "./event-repository";

// Export from repositories
export * from "./repositories";
