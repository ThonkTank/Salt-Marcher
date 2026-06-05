package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization;

// Remove this bridge when worldspace boundary callers use RoomClusterBoundaryMaterialization directly.
final class DungeonClusterBoundaryMaterializationAdapter {

    ClusterBoundaryMaterialization prepare(
            Set<DungeonCell> clusterCells,
            DungeonCell center,
            long clusterId
    ) {
        return new ClusterBoundaryMaterialization(clusterCells, coreCell(center), clusterId);
    }

    private static Set<Cell> coreTouchingClusterCells(
            Set<DungeonCell> clusterCells,
            @Nullable DungeonEdge edge
    ) {
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonCell cell : edge == null ? Set.<DungeonCell>of() : edge.touchingCells()) {
            if (cell == null || clusterCells == null || !clusterCells.contains(cell)) {
                continue;
            }
            Cell coreCell = coreCell(cell);
            if (coreCell != null) {
                result.add(coreCell);
            }
        }
        return Set.copyOf(result);
    }

    private static @Nullable Cell coreCell(@Nullable DungeonCell cell) {
        return cell == null ? null : cell.geometry();
    }

    private static @Nullable Edge coreEdge(@Nullable DungeonEdge edge) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return new Edge(edge.from().geometry(), edge.to().geometry());
    }

    private static BoundaryKind coreKind(
            @Nullable DungeonClusterBoundaryKind kind
    ) {
        if (kind == DungeonClusterBoundaryKind.DOOR) {
            return BoundaryKind.DOOR;
        }
        if (kind == DungeonClusterBoundaryKind.OPEN) {
            return BoundaryKind.OPEN;
        }
        return BoundaryKind.WALL;
    }

    private static @Nullable DungeonClusterBoundary worldspaceBoundary(
            @Nullable BoundaryRow materialized,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        if (materialized == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                materialized.clusterId(),
                materialized.level(),
                DungeonCell.fromGeometry(materialized.relativeCell()),
                DungeonEdgeDirection.valueOf(materialized.direction().name()),
                worldspaceKind(materialized.kind()),
                topologyRef == null ? DungeonTopologyRef.empty() : topologyRef);
    }

    private static DungeonClusterBoundaryKind worldspaceKind(BoundaryKind kind) {
        return switch (kind) {
            case DOOR -> DungeonClusterBoundaryKind.DOOR;
            case OPEN -> DungeonClusterBoundaryKind.OPEN;
            case WALL -> DungeonClusterBoundaryKind.WALL;
        };
    }

    static final class ClusterBoundaryMaterialization {
        private final Set<DungeonCell> clusterCells;
        private final @Nullable Cell center;
        private final long clusterId;

        private ClusterBoundaryMaterialization(
                Set<DungeonCell> clusterCells,
                @Nullable Cell center,
                long clusterId
        ) {
            this.clusterCells = clusterCells == null ? Set.of() : clusterCells;
            this.center = center;
            this.clusterId = clusterId;
        }

        @Nullable DungeonClusterBoundary materializeBoundary(
                DungeonEdge edge,
                DungeonClusterBoundaryKind kind,
                @Nullable DungeonTopologyRef topologyRef
        ) {
            BoundaryRow materialized =
                    RoomClusterBoundaryMaterialization.forEdge(
                            coreTouchingClusterCells(clusterCells, edge),
                            center,
                            clusterId,
                            coreEdge(edge),
                            coreKind(kind));
            return worldspaceBoundary(materialized, topologyRef);
        }

        @Nullable DungeonClusterBoundary materializeOpenBoundary(
                DungeonEdge edge
        ) {
            BoundaryRow materialized =
                    RoomClusterBoundaryMaterialization.openForEdge(
                            coreTouchingClusterCells(clusterCells, edge),
                            center,
                            clusterId,
                            coreEdge(edge));
            return worldspaceBoundary(materialized, DungeonTopologyRef.empty());
        }
    }
}
