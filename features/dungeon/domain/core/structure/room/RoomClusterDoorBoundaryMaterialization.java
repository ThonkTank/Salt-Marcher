package features.dungeon.domain.core.structure.room;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.door.DoorBoundaryMaterialization;

public final class RoomClusterDoorBoundaryMaterialization {
    private final boolean materializesDoor;

    private RoomClusterDoorBoundaryMaterialization(boolean materializesDoor) {
        this.materializesDoor = materializesDoor;
    }

    public static RoomClusterDoorBoundaryMaterialization forEdge(
            @Nullable Edge edge,
            java.util.Map<Long, ? extends Iterable<Cell>> cellsByRoom,
            DoorBoundaryMaterialization.ExistingBoundaryKind existingBoundaryKind
    ) {
        DoorBoundaryMaterialization materialization =
                DoorBoundaryMaterialization.forEdge(edge, cellsByRoom, existingBoundaryKind);
        return new RoomClusterDoorBoundaryMaterialization(materialization.materializesDoor());
    }

    public boolean materializesDoor() {
        return materializesDoor;
    }

}
