import type { Building } from "../../model";
import type { ToolSettings } from "../../properties";

export type BuildingWallStyle = Pick<Building,
  "wall" | "wallAlpha" | "wallBevel" | "wallWidth" | "wallAssetId">;

/** The currently selected Building wall is one tool preset across draw and edit. */
export function buildingWallStyle(
  settings: Pick<ToolSettings, "surfaces" | "room">,
): BuildingWallStyle {
  return {
    wall: settings.surfaces.floor.wallColor,
    wallAlpha: settings.room.wallAlpha ?? 255,
    wallBevel: settings.room.wallBevel ?? true,
    wallWidth: settings.surfaces.floor.wallWidth,
    wallAssetId: settings.room.wallAssetId,
  };
}

export function applyBuildingWallStyle(
  building: Building, style: BuildingWallStyle,
): Building {
  return {
    ...building,
    wall: style.wall,
    wallAlpha: style.wallAlpha,
    wallBevel: style.wallBevel,
    wallWidth: style.wallWidth,
    wallAssetId: style.wallAssetId,
  };
}
