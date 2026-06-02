package src.domain.dungeon.model.core.model.structure;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;

public record CorridorBindings(
        List<CorridorWaypoint> waypoints,
        List<CorridorDoorBinding> doorBindings
) {

    public CorridorBindings {
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
        doorBindings = doorBindings == null ? List.of() : List.copyOf(doorBindings);
    }

    public static CorridorBindings empty() {
        return new CorridorBindings(List.of(), List.of());
    }

    @Override
    public List<CorridorWaypoint> waypoints() {
        return List.copyOf(waypoints);
    }

    @Override
    public List<CorridorDoorBinding> doorBindings() {
        return List.copyOf(doorBindings);
    }

    public CorridorBindings withDoorBinding(CorridorDoorBinding binding) {
        Objects.requireNonNull(binding);
        List<CorridorDoorBinding> updated = new ArrayList<>();
        for (CorridorDoorBinding existing : doorBindings) {
            if (existing.roomId() != binding.roomId()) {
                updated.add(existing);
            }
        }
        updated.add(binding);
        return new CorridorBindings(waypoints, updated);
    }

    public CorridorBindings sanitizedForRooms(CorridorRoomSet rooms) {
        Objects.requireNonNull(rooms);
        if (rooms.roomIds().isEmpty()) {
            return empty();
        }
        List<CorridorDoorBinding> sanitizedDoors = new ArrayList<>();
        for (CorridorDoorBinding binding : doorBindings) {
            if (rooms.connects(binding.roomId())) {
                sanitizedDoors.add(binding);
            }
        }
        return new CorridorBindings(waypoints, sanitizedDoors);
    }
}
