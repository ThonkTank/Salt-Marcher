import type { Building, Door, Entity, Point } from "../../model";
import { followPortalAfterContourEdit, type BuildingContourEdit } from "../../geometry";
import {
  proposeBuildingPointDrag,
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
  const proposal = proposeBuildingPointDrag(before, grip, destination);
  return proposal
    ? previewBuildingMutationWithPortals(entities, before,
      proposal.after, proposal.edit)
    : null;
}
