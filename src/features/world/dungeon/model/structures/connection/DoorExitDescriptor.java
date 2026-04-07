package features.world.dungeon.model.structures.connection;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

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
        localCell = localCell == null ? GridPoint.cell(0, 0, levelZ) : localCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        outsideCell = outsideCell == null ? localCell.step(direction) : outsideCell;
        label = label == null || label.isBlank() ? "Tür " + number : label;
    }
}
