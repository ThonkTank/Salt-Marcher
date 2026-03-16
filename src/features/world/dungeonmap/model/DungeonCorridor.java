package features.world.dungeonmap.model;

import java.util.List;

public record DungeonCorridor(
        Long corridorId,
        long mapId,
        List<Long> roomIds,
        List<CorridorDoorOverride> doorOverrides,
        List<CorridorWaypoint> waypoints
) {
    public DungeonCorridor {
        roomIds = roomIds == null ? List.of() : List.copyOf(roomIds);
        doorOverrides = doorOverrides == null ? List.of() : List.copyOf(doorOverrides);
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
    }
}
