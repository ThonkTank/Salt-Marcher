package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.objects.DoorRef;

public record DoorExitDescriptor(
        DoorRef doorRef,
        int number,
        int levelZ,
        CellCoord localCell,
        CellCoord outsideCell,
        CardinalDirection direction,
        String label
) {
    public DoorExitDescriptor {
        doorRef = java.util.Objects.requireNonNull(doorRef, "doorRef");
        number = number <= 0 ? 1 : number;
        localCell = localCell == null ? new CellCoord(0, 0) : localCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        outsideCell = outsideCell == null ? localCell.add(direction.delta()) : outsideCell;
        label = label == null || label.isBlank() ? "Tür " + number : label;
    }
}
