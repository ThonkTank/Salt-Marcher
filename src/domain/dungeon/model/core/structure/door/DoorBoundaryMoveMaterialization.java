package src.domain.dungeon.model.core.structure.door;

import src.domain.dungeon.model.core.structure.DungeonMap;

final class DoorBoundaryMoveMaterialization {

    boolean targetMaterializesDoor(DungeonMap sourceMap, DoorBindingMoveContext context) {
        return DoorBoundaryRelocationGeometry.targetMaterializesDoor(
                sourceMap,
                context.targetCluster(),
                context.nextDoorEdge(),
                context.nextBoundary());
    }
}
