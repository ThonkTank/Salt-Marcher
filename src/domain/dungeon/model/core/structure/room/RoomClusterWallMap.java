package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.boundary.BoundaryMap;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

public final class RoomClusterWallMap {
    private final BoundaryMap boundaryMap;
    private final Map<EdgeKey, BoundaryRow> rowsByKey;

    public RoomClusterWallMap(@Nullable Cell center, Iterable<BoundaryRow> rows) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, 0) : center;
        this.rowsByKey = RoomClusterWallRows.normalizeRows(resolvedCenter, rows);
        this.boundaryMap = RoomClusterBoundaryMapAdapter.boundaryMap(rowsByKey);
    }

    private RoomClusterWallMap(Map<EdgeKey, BoundaryRow> rowsByKey) {
        this.rowsByKey = RoomClusterWallRows.copyRowsByKey(rowsByKey);
        this.boundaryMap = RoomClusterBoundaryMapAdapter.boundaryMap(this.rowsByKey);
    }

    public static RoomClusterWallMap fromKeyedRows(Map<EdgeKey, BoundaryRow> rowsByKey) {
        return new RoomClusterWallMap(rowsByKey);
    }

    public Optional<RoomClusterBoundaryStretchPlan.Selection> stretchSelection(
            RoomClusterFloorMap floorMap,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return RoomClusterBoundaryStretchPlan.resolve(
                floorMap == null ? List.of() : floorMap.allCells(),
                sourceEdges,
                rowsByKey,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    public List<Cell> authoredBoundaryVertices(int level) {
        return RoomClusterBoundaryVertices.authored(boundaryMap, level);
    }

    public List<WallRun> authoredWallRuns(int level) {
        return RoomClusterWallRuns.authoredWallRuns(boundaryMap, rowsByKey, level);
    }

    public static List<Edge> authoredWallDeleteEdges(
            Iterable<Edge> authoredWallEdges,
            Iterable<Edge> targetEdges
    ) {
        return RoomClusterWallRunDelete.authoredWallDeleteEdges(authoredWallEdges, targetEdges);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof RoomClusterWallMap that
                && boundaryMap.equals(that.boundaryMap)
                && rowsByKey.equals(that.rowsByKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(boundaryMap, rowsByKey);
    }

    static @Nullable BoundaryRow materializeRow(
            Iterable<Cell> clusterCells,
            @Nullable Cell center,
            long clusterId,
            @Nullable Edge edge,
            @Nullable BoundaryKind kind
    ) {
        return RoomClusterWallMaterialization.materializeRow(clusterCells, center, clusterId, edge, kind);
    }

    static List<BoundaryRow> sortedRows(Iterable<BoundaryRow> rows) {
        return RoomClusterWallRows.sortedRows(rows);
    }

    static EdgeKey keyForRow(@Nullable Cell center, BoundaryRow row) {
        return RoomClusterWallRows.keyForRow(center, row);
    }

    public record WallRun(Cell anchorCell, double markerQ, double markerR, Direction direction) {
        public WallRun {
            anchorCell = anchorCell == null ? new Cell(0, 0, 0) : anchorCell;
            markerQ = Double.isFinite(markerQ) ? markerQ : anchorCell.q();
            markerR = Double.isFinite(markerR) ? markerR : anchorCell.r();
            direction = direction == null ? Direction.NORTH : direction;
        }
    }
}
