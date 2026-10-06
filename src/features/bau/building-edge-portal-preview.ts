import type { Building, Door, Entity, Point } from "../../model";
import { followPortalAfterContourEdit, type BuildingContourEdit } from "../../geometry";
import {
  previewBuildingEdgeDrag,
  type BuildingEdgeGrip,
} from "./building-point-gestures";

export interface BuildingEdgePortalPreview {
  readonly building: Building;
  readonly portals: readonly {
    readonly before: Door;
    readonly after: Door | null;
  }[];
}

export function previewBuildingMutationWithPortals(
  entities: readonly Entity[],
  before: Building,
  building: Building,
  edit: BuildingContourEdit,
): BuildingEdgePortalPreview {
  const portals = entities.flatMap((entity) =>
    entity.kind === "door" && entity.anchor?.boundaryId === before.id
      ? [{
          before: entity,
          after: followPortalAfterContourEdit(entity, before, building, edit),
        }]
      : [],
  );
  return { building, portals };
}

/** Compute the same portal anchors as an edge-insertion commit, without history. */
export function previewBuildingEdgeWithPortals(
  entities: readonly Entity[],
  before: Building,
  grip: BuildingEdgeGrip,
  destination: Point,
): BuildingEdgePortalPreview | null {
  const building = previewBuildingEdgeDrag(before, grip, destination);
  if (!building) return null;
  const edit = {
    kind: "insert" as const,
    contour: grip.contour,
    index: grip.index + 1,
  };
  return previewBuildingMutationWithPortals(entities, before, building, edit);
}
