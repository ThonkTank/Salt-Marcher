package src.data.dungeon.model;

import java.util.List;

public record DungeonCorridorRecord(
        long corridorId,
        long mapId,
        int levelZ,
        List<Long> roomIds,
        List<DungeonCorridorWaypointRecord> waypoints,
        List<DungeonCorridorDoorBindingRecord> doorBindings
) {

    public DungeonCorridorRecord {
        roomIds = roomIds == null ? List.of() : List.copyOf(roomIds);
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
    }
}
