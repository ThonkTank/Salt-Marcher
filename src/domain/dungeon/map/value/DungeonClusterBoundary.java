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
        DungeonCell from = absoluteCell(center);
        return new DungeonEdge(from, direction.neighborOf(from));
    }

    public DungeonTopologyRef resolvedTopologyRef(DungeonCell center) {
        if (topologyRef.present()) {
            return topologyRef;
        }
        return new DungeonTopologyRef(
                kind == DungeonClusterBoundaryKind.DOOR
                        ? DungeonTopologyElementKind.DOOR
                        : DungeonTopologyElementKind.WALL,
                DungeonBoundaryKey.from(absoluteEdge(center)).stableId());
    }
}
