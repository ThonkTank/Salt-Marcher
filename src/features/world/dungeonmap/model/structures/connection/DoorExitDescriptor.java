package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;

public record DoorExitDescriptor(
        DoorRef doorRef,
        int number,
        int levelZ,
        GridPoint localCell,
        GridPoint outsideCell,
        CardinalDirection direction,
        String label
) {
    public DoorExitDescriptor {
        doorRef = java.util.Objects.requireNonNull(doorRef, "doorRef");
        number = number <= 0 ? 1 : number;
        localCell = localCell == null ? new GridPoint(0, 0) : localCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        outsideCell = outsideCell == null ? localCell.add(direction.delta()) : outsideCell;
        label = label == null || label.isBlank() ? "Tür " + number : label;
    }
}
