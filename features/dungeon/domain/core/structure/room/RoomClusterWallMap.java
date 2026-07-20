package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

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

    public List<RoomClusterWallRun> authoredWallRuns(int level) {
        return RoomClusterWallRuns.authoredWallRuns(boundaryMap, rowsByKey, level);
    }

    public static List<Edge> authoredWallDeleteEdges(
            Iterable<Edge> authoredWallEdges,
            Iterable<Edge> targetEdges
    ) {
        return authoredWallDeleteResolver(authoredWallEdges).deleteEdges(targetEdges);
    }

    public static RoomClusterWallDeleteResolver authoredWallDeleteResolver(Iterable<Edge> authoredWallEdges) {
        return new RoomClusterWallDeleteResolver(RoomClusterWallRunEdges.keyed(authoredWallEdges));
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

}
