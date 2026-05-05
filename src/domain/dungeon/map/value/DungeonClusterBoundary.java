package src.domain.dungeon.map.value;

public record DungeonClusterBoundary(
        long clusterId,
        int level,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction,
        DungeonClusterBoundaryKind kind,
        DungeonTopologyRef topologyRef
) {

    public DungeonClusterBoundary(
            long clusterId,
            int level,
            DungeonCell relativeCell,
            DungeonEdgeDirection direction,
            DungeonClusterBoundaryKind kind
    ) {
        this(clusterId, level, relativeCell, direction, kind, DungeonTopologyRef.empty());
    }

    public DungeonClusterBoundary {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, level) : relativeCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        kind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public DungeonCell absoluteCell(DungeonCell center) {
        DungeonCell resolvedCenter = center == null ? new DungeonCell(0, 0, level) : center;
        return new DungeonCell(
                resolvedCenter.q() + relativeCell.q(),
                resolvedCenter.r() + relativeCell.r(),
                level);
    }

    public DungeonEdge absoluteEdge(DungeonCell center) {
        return DungeonEdge.sideOf(absoluteCell(center), direction);
    }

    public boolean isDoor() {
        return kind == DungeonClusterBoundaryKind.DOOR;
    }

    public boolean matchesAbsoluteEdge(DungeonCell center, DungeonEdge edge) {
        return edge != null && DungeonBoundaryKey.from(absoluteEdge(center)).equals(DungeonBoundaryKey.from(edge));
    }

    public DungeonTopologyRef resolvedTopologyRef(DungeonCell center) {
        if (topologyRef.present()) {
            return topologyRef;
        }
        long boundaryId = DungeonBoundaryKey.from(absoluteEdge(center)).stableId();
        return isDoor() ? DungeonTopologyRef.door(boundaryId) : DungeonTopologyRef.wall(boundaryId);
    }
}
