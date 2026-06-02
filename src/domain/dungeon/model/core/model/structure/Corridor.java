package src.domain.dungeon.model.core.model.structure;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.model.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.model.component.CorridorWaypoint;

public record Corridor(
        long corridorId,
        long mapId,
        int level,
        CorridorRoomSet rooms,
        CorridorBindings bindings
) {
    public Corridor {
        corridorId = Math.max(0L, corridorId);
        mapId = Math.max(0L, mapId);
        rooms = rooms == null ? new CorridorRoomSet(List.of()) : rooms;
        bindings = bindings == null ? CorridorBindings.empty() : bindings;
    }

    public Corridor(
            long corridorId,
            long mapId,
            int level,
            List<Long> roomIds,
            CorridorBindings bindings
    ) {
        this(corridorId, mapId, level, new CorridorRoomSet(roomIds), bindings);
    }

    public List<Long> roomIds() {
        return rooms.roomIds();
    }

    public boolean isReadable() {
        return endpointCount() >= 2 || !bindings.waypoints().isEmpty();
    }

    public boolean connectsRoom(long roomId) {
        return rooms.connects(roomId);
    }

    public int endpointCount() {
        return bindings.doorBindings().size() + bindings.anchorRefs().size();
    }

    public Corridor withAddedRoom(long roomId) {
        CorridorRoomSet nextRooms = rooms.withAdded(roomId);
        return nextRooms.equals(rooms) ? this : withRooms(nextRooms);
    }

    public Corridor withDoorBinding(CorridorDoorBinding binding) {
        Objects.requireNonNull(binding);
        Corridor updated = connectsRoom(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return updated.withBindings(updated.bindings.withDoorBinding(binding));
    }

    public Corridor withoutDoorTarget(
            CorridorDoorBinding removedDoor,
            boolean pruneRouteWaypoints,
            int firstEndpointIndex,
            int secondEndpointIndex
    ) {
        Objects.requireNonNull(removedDoor);
        CorridorRoomSet nextRooms = rooms.without(removedDoor.roomId());
        List<CorridorWaypoint> nextWaypoints = pruneRouteWaypoints
                ? bindings.waypointsBetweenEndpointIndexes(firstEndpointIndex, secondEndpointIndex)
                : bindings.waypoints();
        CorridorBindings nextBindings = bindings
                .withoutDoorBindingForRoom(removedDoor.roomId())
                .withWaypoints(nextWaypoints);
        return new Corridor(corridorId, mapId, level, nextRooms, nextBindings);
    }

    public Corridor withoutAnchorTarget(long anchorId) {
        return withBindings(bindings.withoutAnchorRefAndRouteWaypoints(anchorId));
    }

    public Corridor withoutWaypointTarget(int waypointIndex) {
        return withBindings(bindings.withoutWaypoint(waypointIndex));
    }

    public Corridor withBindings(CorridorBindings nextBindings) {
        return new Corridor(corridorId, mapId, level, rooms, nextBindings);
    }

    private Corridor withRooms(CorridorRoomSet nextRooms) {
        return new Corridor(corridorId, mapId, level, nextRooms, bindings);
    }
}
