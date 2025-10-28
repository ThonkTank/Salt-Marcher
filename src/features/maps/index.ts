// src/features/maps/index.ts
// Main feature export

// Domain
export * from "./domain/options";
export * from "./domain/terrain";
export * from "./domain/region";
export * from "./domain/faction-colors";

// Data
export * from "./data/terrain-repository";
export * from "./data/region-repository";
export * from "./data/tile-repository";
export * from "./data/map-repository";
export * from "./state/faction-overlay-store";

// Rendering
export * from "./rendering/hex-render";
export type { RenderHandles } from "./rendering/hex-render";
