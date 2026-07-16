package features.dungeon.adapter.sqlite.model;

public record DungeonCorridorWaypointRecord(
        long corridorId,
        long clusterId,
        int relativeX,
        int relativeY,
        int relativeZ
) {
}
