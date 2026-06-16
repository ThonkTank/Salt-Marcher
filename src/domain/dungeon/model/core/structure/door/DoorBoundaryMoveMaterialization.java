package src.domain.dungeon.model.core.structure.door;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;

final class DoorBoundaryMoveMaterialization {
    private static final RoomCellCoverage ROOM_CELL_COVERAGE = new RoomCellCoverage();

    boolean targetMaterializesDoor(DungeonMap sourceMap, DoorBindingMoveContext context) {
        return DoorBoundaryMaterialization.forEdge(
                context.nextDoorEdge(),
                ROOM_CELL_COVERAGE.cellsByRoom(
                        context.targetCluster(),
                        roomsInCluster(sourceMap, context.targetCluster().clusterId())),
                boundaryKind(context.nextBoundary())).materializesDoor();
    }

    private static List<DungeonRoom> roomsInCluster(DungeonMap dungeonMap, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static DoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable DungeonClusterBoundary boundary
    ) {
        if (boundary == null) {
            return DoorBoundaryMaterialization.noExistingBoundary();
        }
        return boundary.isDoor()
                ? DoorBoundaryMaterialization.existingDoorBoundary()
                : DoorBoundaryMaterialization.existingNonDoorBoundary();
    }
}
