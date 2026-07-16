package features.dungeon.domain.core.structure.door;

import features.dungeon.domain.core.structure.DungeonMap;

final class DoorBoundaryMoveMaterialization {

    boolean targetMaterializesDoor(DungeonMap sourceMap, DoorBindingMoveContext context) {
        return DoorBoundaryRelocationGeometry.targetMaterializesDoor(
                sourceMap,
                context.targetCluster(),
                context.nextDoorEdge(),
                context.nextBoundary());
    }
}
