package src.domain.dungeon.model.worldspace.model;

public record DungeonCorridorWaypoint(
        long clusterId,
        DungeonCell relativeCell,
        int level
) {

    public DungeonCorridorWaypoint {
        relativeCell = relativeCell == null ? new DungeonCell(0, 0, level) : relativeCell;
    }

    public DungeonCell absoluteCell(DungeonCell clusterCenter) {
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, level) : clusterCenter;
        return new DungeonCell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                level);
    }
}
