// Generated from the Atlas Rust command list. Do not edit.
import type { AllCommands } from "./AllCommands";
export type Commands = Pick<
  AllCommands,
  | "terrainTiles"
  | "status"
  | "new"
  | "extent"
  | "mapTiles"
  | "objectHeader"
  | "roadHeader"
  | "scene"
  | "interiorMetadata"
  | "interiorTile"
  | "preview"
  | "commit"
  | "history"
>;
export type ReadCommands = Pick<
  Commands,
  | "terrainTiles"
  | "mapTiles"
  | "objectHeader"
  | "roadHeader"
  | "scene"
  | "interiorMetadata"
  | "interiorTile"
>;
export type AdapterCommands = Pick<AllCommands, "detail" | "save" | "open">;
