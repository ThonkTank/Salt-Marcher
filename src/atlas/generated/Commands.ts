// Generated from the Atlas Rust command list. Do not edit.
import type { AllCommands } from "./AllCommands";
export type Commands = Pick<
  AllCommands,
  | "status"
  | "new"
  | "extent"
  | "mapTiles"
  | "scene"
  | "interiorMetadata"
  | "interiorTile"
  | "preview"
  | "commit"
  | "history"
>;
export type ReadCommands = Pick<
  Commands,
  "mapTiles" | "scene" | "interiorMetadata" | "interiorTile"
>;
export type AdapterCommands = Pick<AllCommands, "detail" | "save" | "open">;
