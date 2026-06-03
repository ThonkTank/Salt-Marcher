package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonCorridorWaypoint(
        long clusterId,
        DungeonCell relativeCell,
        int level
) {

    public DungeonCorridorWaypoint {
        CorridorWaypoint waypoint = new CorridorWaypoint(
                clusterId,
                relativeCell == null ? new Cell(0, 0, level) : relativeCell.geometry(),
                level);
        clusterId = waypoint.clusterId();
        relativeCell = DungeonCell.fromGeometry(waypoint.relativeCell());
    }

    public DungeonCell absoluteCell(DungeonCell clusterCenter) {
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, level) : clusterCenter;
        return DungeonCell.fromGeometry(new CorridorWaypoint(clusterId, relativeCell.geometry(), level)
                .absoluteCell(center.geometry()));
    }

    CorridorWaypoint toCore() {
        return new CorridorWaypoint(clusterId, relativeCell.geometry(), level);
    }

    static DungeonCorridorWaypoint fromCore(CorridorWaypoint waypoint) {
        return new DungeonCorridorWaypoint(
                waypoint.clusterId(),
                DungeonCell.fromGeometry(waypoint.relativeCell()),
                waypoint.level());
    }
}
