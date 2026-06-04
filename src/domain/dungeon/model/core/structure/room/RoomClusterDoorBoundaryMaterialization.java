package src.domain.dungeon.model.core.structure.room;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.door.DoorBoundaryMaterialization;

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
