package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.List;

public record RoomExitDescriptor(
        int number,
        int levelZ,
        CellCoord roomCell,
        CellCoord outsideCell,
        CardinalDirection direction,
        String label,
        GridSegment2x anchorSegment2x,
        List<GridSegment2x> openingSegments2x
) {
    public RoomExitDescriptor {
        number = number <= 0 ? 1 : number;
        roomCell = roomCell == null ? new CellCoord(0, 0) : roomCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        outsideCell = outsideCell == null ? roomCell.add(direction.delta()) : outsideCell;
        label = label == null || label.isBlank() ? "Tür " + number : label;
        anchorSegment2x = anchorSegment2x == null
                ? GridSegment2x.boundaryEdge(roomCell, direction)
                : anchorSegment2x;
        openingSegments2x = openingSegments2x == null ? List.of() : List.copyOf(openingSegments2x);
    }
}
