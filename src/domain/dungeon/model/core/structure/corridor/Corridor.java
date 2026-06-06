package src.domain.dungeon.model.core.structure.corridor;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorDoorBinding;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record Corridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        CorridorBindingState stateBindings
) {

    public Corridor {
        corridorId = Math.max(0L, corridorId);
        mapId = Math.max(0L, mapId);
        roomIds = new CorridorRoomSet(roomIds).roomIds();
        stateBindings = stateBindings == null ? CorridorBindingState.empty() : stateBindings;
    }

    public Corridor(
            long corridorId,
            long mapId,
            int level,
            CorridorRoomSet rooms,
            CorridorBindingState bindings
    ) {
        this(corridorId, mapId, level, rooms == null ? List.of() : rooms.roomIds(), bindings);
    }

    public Corridor(
            long corridorId,
            long mapId,
            int level,
            CorridorRoomSet rooms,
            CorridorBindings bindings
    ) {
        this(corridorId, mapId, level, rooms, stateFromCore(bindings));
    }

    public CorridorBindings coreBindings() {
        return stateBindings.toCore();
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return endpointCount() >= 2 || !stateBindings.waypoints().isEmpty();
    }

    public int endpointCount() {
        return stateBindings.doorBindings().size() + stateBindings.anchorRefs().size();
    }

    public Corridor withDoorBinding(CorridorDoorBinding binding) {
        Objects.requireNonNull(binding);
        return withDoorBinding(new CorridorDoorBindingState(
                binding.roomId(),
                binding.clusterId(),
                binding.relativeCell(),
                binding.direction(),
                DungeonTopologyRef.empty()));
    }

    public Corridor withoutDoorTarget(
            CorridorDoorBinding removedDoor,
            boolean pruneRouteWaypoints,
            int firstEndpointIndex,
            int secondEndpointIndex
    ) {
        Objects.requireNonNull(removedDoor);
        CorridorRoomSet nextRooms = roomSet().without(removedDoor.roomId());
        CorridorBindings nextBindings = coreBindings().withoutDoorTarget(
                removedDoor,
                pruneRouteWaypoints,
                firstEndpointIndex,
                secondEndpointIndex);
        return new Corridor(
                corridorId,
                mapId,
                level,
                nextRooms,
                CorridorBindingState.fromCore(stateBindings, nextBindings, null));
    }

    public Corridor withoutAnchorTarget(long anchorId) {
        return withBindings(coreBindings().withoutAnchorRefAndRouteWaypoints(anchorId));
    }

    public Corridor withoutWaypointTarget(int waypointIndex) {
        return withBindings(coreBindings().withoutWaypoint(waypointIndex));
    }

    public Corridor withBindings(CorridorBindings nextBindings) {
        return withStateBindings(CorridorBindingState.fromCore(stateBindings, nextBindings, null));
    }

    public Corridor withStateBindings(CorridorBindingState nextBindings) {
        return new Corridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    public Corridor withResolvedEndpoint(
            CorridorResolvedEndpoint endpoint,
            @Nullable CorridorDoorBindingState replacementDoor
    ) {
        Objects.requireNonNull(endpoint, "endpoint");
        Corridor resolvedCore = endpoint.applyTo(coreIdentity());
        return fromCore(this, resolvedCore, replacementDoor);
    }

    public static Corridor fromCore(
            Corridor source,
            Corridor coreCorridor,
            @Nullable CorridorDoorBindingState replacementDoor
    ) {
        return fromCore(source, coreCorridor, replacementDoor, null);
    }

    public static Corridor fromCore(
            Corridor source,
            Corridor coreCorridor,
            @Nullable CorridorDoorBindingState replacementDoor,
            @Nullable CorridorAnchorBinding replacementAnchor
    ) {
        return new Corridor(
                coreCorridor.corridorId(),
                coreCorridor.mapId(),
                coreCorridor.level(),
                coreCorridor.roomIds(),
                CorridorBindingState.fromCore(
                        source.stateBindings(),
                        coreCorridor.coreBindings(),
                        replacementDoor,
                        replacementAnchor));
    }

    private Corridor withDoorBinding(CorridorDoorBindingState binding) {
        Objects.requireNonNull(binding);
        Corridor updated = roomSet().connects(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        CorridorBindings nextBindings = updated.coreBindings().withDoorBinding(binding.toCore());
        return updated.withStateBindings(CorridorBindingState.fromCore(
                updated.stateBindings,
                nextBindings,
                binding));
    }

    private Corridor withAddedRoom(long roomId) {
        CorridorRoomSet nextRooms = roomSet().withAdded(roomId);
        return nextRooms.roomIds().equals(roomIds) ? this : withRoomSet(nextRooms);
    }

    private Corridor withRoomSet(CorridorRoomSet nextRooms) {
        return new Corridor(corridorId, mapId, level, nextRooms, stateBindings);
    }

    private Corridor coreIdentity() {
        return new Corridor(corridorId, mapId, level, new CorridorRoomSet(roomIds), coreBindings());
    }

    private CorridorRoomSet roomSet() {
        return new CorridorRoomSet(roomIds);
    }

    private static CorridorBindingState stateFromCore(CorridorBindings bindings) {
        return CorridorBindingState.fromCore(
                CorridorBindingState.empty(),
                bindings == null ? CorridorBindings.empty() : bindings,
                null);
    }
}
