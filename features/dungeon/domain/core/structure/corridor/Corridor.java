package features.dungeon.domain.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import features.dungeon.domain.core.component.CorridorDoorBinding;

public record Corridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        CorridorBindings bindings
) {

    public Corridor {
        corridorId = Math.max(0L, corridorId);
        mapId = Math.max(0L, mapId);
        roomIds = new CorridorRoomSet(roomIds).roomIds();
        bindings = bindings == null ? CorridorBindings.empty() : bindings;
    }

    public Corridor(
            long corridorId,
            long mapId,
            int level,
            CorridorRoomSet rooms,
            CorridorBindings bindings
    ) {
        this(corridorId, mapId, level, rooms == null ? List.of() : rooms.roomIds(), bindings);
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return endpointCount() >= 2 || !bindings.waypoints().isEmpty();
    }

    public int endpointCount() {
        return bindings.doorBindings().size() + bindings.anchorRefs().size();
    }

    public Corridor withDoorBinding(CorridorDoorBinding binding) {
        Objects.requireNonNull(binding);
        Corridor updated = roomSet().connects(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return updated.withBindings(updated.bindings.withDoorBinding(binding));
    }

    public Corridor withoutDoorTarget(
            CorridorDoorBinding removedDoor,
            boolean pruneRouteWaypoints,
            int firstEndpointIndex,
            int secondEndpointIndex
    ) {
        Objects.requireNonNull(removedDoor);
        return new Corridor(
                corridorId,
                mapId,
                level,
                roomSet().without(removedDoor.roomId()),
                bindings.withoutDoorTarget(
                        removedDoor,
                        pruneRouteWaypoints,
                        firstEndpointIndex,
                        secondEndpointIndex));
    }

    public Corridor withoutAnchorTarget(long anchorId) {
        return withBindings(bindings.withoutAnchorRefAndRouteWaypoints(anchorId));
    }

    public Corridor withoutWaypointTarget(int waypointIndex) {
        return withBindings(bindings.withoutWaypoint(waypointIndex));
    }

    public Corridor withBindings(CorridorBindings nextBindings) {
        return new Corridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    public Corridor withResolvedEndpoint(CorridorResolvedEndpoint endpoint) {
        return Objects.requireNonNull(endpoint, "endpoint").applyTo(this);
    }

    private Corridor withAddedRoom(long roomId) {
        CorridorRoomSet nextRooms = roomSet().withAdded(roomId);
        return nextRooms.roomIds().equals(roomIds) ? this : withRoomSet(nextRooms);
    }

    private Corridor withRoomSet(CorridorRoomSet nextRooms) {
        return new Corridor(corridorId, mapId, level, nextRooms, bindings);
    }

    private CorridorRoomSet roomSet() {
        return new CorridorRoomSet(roomIds);
    }
}
