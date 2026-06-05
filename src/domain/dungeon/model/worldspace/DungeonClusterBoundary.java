package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonClusterBoundary(
        long clusterId,
        int level,
        Cell relativeCell,
        Direction direction,
        DungeonClusterBoundaryKind kind,
        DungeonTopologyRef topologyRef
) {

    public DungeonClusterBoundary(
            long clusterId,
            int level,
            Cell relativeCell,
            Direction direction,
            DungeonClusterBoundaryKind kind
    ) {
        this(clusterId, level, relativeCell, direction, kind, DungeonTopologyRef.empty());
    }

    public DungeonClusterBoundary {
        relativeCell = relativeCell == null ? new Cell(0, 0, level) : relativeCell;
        direction = direction == null ? Direction.NORTH : direction;
        kind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public Cell absoluteCell(Cell center) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, level) : center;
        return new Cell(
                resolvedCenter.q() + relativeCell.q(),
                resolvedCenter.r() + relativeCell.r(),
                level);
    }

    public Edge absoluteEdge(Cell center) {
        return Edge.sideOf(absoluteCell(center), direction);
    }

    public boolean isDoor() {
        return kind == DungeonClusterBoundaryKind.DOOR;
    }

    public boolean isOpen() {
        return kind == DungeonClusterBoundaryKind.OPEN;
    }

    public boolean matchesAbsoluteEdge(Cell center, Edge edge) {
        return edge != null && DungeonBoundaryKey.from(absoluteEdge(center)).equals(DungeonBoundaryKey.from(edge));
    }

    public DungeonTopologyRef resolvedTopologyRef(Cell center) {
        if (isOpen()) {
            return DungeonTopologyRef.empty();
        }
        if (topologyRef.present()) {
            return topologyRef;
        }
        long boundaryId = DungeonBoundaryKey.from(absoluteEdge(center)).stableId();
        return isDoor() ? DungeonTopologyRef.door(boundaryId) : DungeonTopologyRef.wall(boundaryId);
    }
}
