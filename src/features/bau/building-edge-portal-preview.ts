import type { Building, Door, Entity } from "../../model";
import { followPortalAfterContourEdit, type BuildingContourEdit } from "../../geometry";

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
