package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonCorridorBindings(
        List<DungeonCorridorWaypoint> waypoints,
        List<DungeonCorridorDoorBinding> doorBindings
) {

    public DungeonCorridorBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
    }

    public static DungeonCorridorBindings empty() {
        return new DungeonCorridorBindings(List.of(), List.of());
    }
}
