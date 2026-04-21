package src.domain.dungeon.map.value;

public record DungeonClusterBoundary(
        long clusterId,
        int level,
        DungeonCell relativeCell,
        DungeonEdgeDirection direction,
        DungeonClusterBoundaryKind kind
) {

    public DungeonClusterBoundary {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, level) : relativeCell;
        direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
        kind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
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
}
