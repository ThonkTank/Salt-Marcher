package src.domain.dungeon.model.worldspace.model;


import java.util.List;

public record DungeonCorridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        DungeonCorridorBindings bindings
) {
    public DungeonCorridor {
        roomIds = DungeonCorridorRoomIds.normalized(roomIds);
        bindings = bindings == null ? DungeonCorridorBindings.empty() : bindings;
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return endpointCount() >= 2 || !bindings.waypoints().isEmpty();
    }

    public boolean connectsRoom(long roomId) {
        return roomId > 0L && roomIds.contains(roomId);
    }

    public DungeonCorridor withAddedRoom(long roomId) {
        if (roomId <= 0L || roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = new java.util.ArrayList<>(roomIds);
        updated.add(roomId);
        return new DungeonCorridor(
                corridorId,
                mapId,
                level,
                updated,
                bindings.sanitizedForRooms(updated));
    }

    public DungeonCorridor withDoorBinding(DungeonCorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        DungeonCorridor updated = connectsRoom(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return new DungeonCorridor(
                updated.corridorId,
                updated.mapId,
                updated.level,
                updated.roomIds,
                updated.bindings.withDoorBinding(binding));
    }

    public DungeonCorridor withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null) {
            return this;
        }
        return new DungeonCorridor(
                corridorId,
                mapId,
                level,
                roomIds,
                bindings.withAnchorBinding(binding));
    }

    public DungeonCorridor withAnchorRef(DungeonCorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        return new DungeonCorridor(
                corridorId,
                mapId,
                level,
                roomIds,
                bindings.withAnchorRef(ref));
    }

    public DungeonCorridor withBindings(DungeonCorridorBindings nextBindings) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    public int endpointCount() {
        return bindings.doorBindings().size() + bindings.anchorRefs().size();
    }
}
