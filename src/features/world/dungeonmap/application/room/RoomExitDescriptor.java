package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.List;

public record RoomExitDescriptor(
        int number,
        int levelZ,
        Point2i roomCell,
        Point2i outsideCell,
        Point2i direction,
        String label,
        LegacyGridSegment2x anchorSegment2x,
        List<LegacyGridSegment2x> openingSegments2x
) {
    public RoomExitDescriptor {
        number = number <= 0 ? 1 : number;
        levelZ = levelZ;
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        outsideCell = outsideCell == null ? roomCell.add(direction == null ? new Point2i(0, -1) : direction) : outsideCell;
        direction = direction == null ? new Point2i(0, -1) : direction;
        label = label == null || label.isBlank() ? "Tür " + number : label;
        anchorSegment2x = anchorSegment2x == null
                ? LegacyGridSegment2x.betweenCellAndStep(roomCell, direction)
                : anchorSegment2x;
        openingSegments2x = openingSegments2x == null ? List.of() : List.copyOf(openingSegments2x);
    }
}
