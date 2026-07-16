package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;

public record RoomClusterWallRun(
        Cell anchorCell,
        double markerQ,
        double markerR,
        Direction direction,
        RoomClusterWallRunSource source
) {
    public RoomClusterWallRun {
        anchorCell = anchorCell == null ? new Cell(0, 0, 0) : anchorCell;
        markerQ = Double.isFinite(markerQ) ? markerQ : anchorCell.q();
        markerR = Double.isFinite(markerR) ? markerR : anchorCell.r();
        direction = direction == null ? Direction.NORTH : direction;
        source = source == null ? RoomClusterWallRunSource.empty() : source;
    }
}
