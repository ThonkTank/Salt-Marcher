package src.data.dungeon.model;

public record DungeonCorridorWaypointRecord(
        long corridorId,
        long clusterId,
        int relativeX,
        int relativeY,
        int relativeZ
) {
}
