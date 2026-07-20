package features.dungeon.domain.core.component.boundary;

import java.util.List;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.EdgeKey;

public record WallRun(
        Cell anchorCell,
        double markerQ,
        double markerR,
        List<EdgeKey> edgeKeys
) {
    public WallRun {
        anchorCell = anchorCell == null ? new Cell(0, 0, 0) : anchorCell;
        markerQ = Double.isFinite(markerQ) ? markerQ : anchorCell.q();
        markerR = Double.isFinite(markerR) ? markerR : anchorCell.r();
        edgeKeys = edgeKeys == null ? List.of() : List.copyOf(edgeKeys);
    }
}
