package src.domain.dungeon.map.entity;

import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class DungeonCorridor {

    private final long corridorId;
    private final long mapId;
    private final int level;
    private final List<Long> roomIds;
    private final DungeonCorridorBindings bindings;

    public DungeonCorridor(
            long corridorId,
            long mapId,
            int level,
            List<Long> roomIds,
            DungeonCorridorBindings bindings
    ) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.level = level;
        this.roomIds = normalizeRoomIds(roomIds);
        this.bindings = bindings == null ? DungeonCorridorBindings.empty() : bindings;
    }

    public long corridorId() {
        return corridorId;
    }

    public long mapId() {
        return mapId;
    }

    public int level() {
        return level;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public DungeonCorridorBindings bindings() {
        return bindings;
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
        List<Long> updated = new ArrayList<>(roomIds);
        updated.add(roomId);
        return new DungeonCorridor(corridorId, mapId, level, updated, bindings.sanitizedForRooms(updated));
    }

    public DungeonCorridor withoutRoom(long roomId) {
        if (roomId <= 0L || !roomIds.contains(roomId)) {
            return this;
        }
        List<Long> updated = roomIds.stream()
                .filter(existing -> existing != roomId)
                .toList();
        return new DungeonCorridor(corridorId, mapId, level, updated, bindings.withoutDoorBinding(roomId));
    }

    public DungeonCorridor withDoorBinding(DungeonCorridorDoorBinding binding) {
        if (binding == null) {
            return this;
        }
        DungeonCorridor updated = connectsRoom(binding.roomId()) ? this : withAddedRoom(binding.roomId());
        return new DungeonCorridor(
                updated.corridorId(),
                updated.mapId(),
                updated.level(),
                updated.roomIds(),
                updated.bindings().withDoorBinding(binding));
    }

    public DungeonCorridor withAnchorBinding(DungeonCorridorAnchorBinding binding) {
        if (binding == null) {
            return this;
        }
        return new DungeonCorridor(corridorId, mapId, level, roomIds, bindings.withAnchorBinding(binding));
    }

    public DungeonCorridor withAnchorRef(DungeonCorridorAnchorRef ref) {
        if (ref == null || !ref.present()) {
            return this;
        }
        return new DungeonCorridor(corridorId, mapId, level, roomIds, bindings.withAnchorRef(ref));
    }

    public DungeonCorridor withoutDoorBinding(long roomId) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, bindings.withoutDoorBinding(roomId));
    }

    public DungeonCorridor withBindings(DungeonCorridorBindings nextBindings) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    public DungeonCorridor mergeKeepingThis(DungeonCorridor other) {
        if (other == null || other == this) {
            return this;
        }
        List<Long> mergedInput = new ArrayList<>(roomIds);
        mergedInput.addAll(other.roomIds());
        List<Long> mergedRoomIds = normalizeRoomIds(mergedInput);
        return new DungeonCorridor(
                corridorId,
                mapId,
                level,
                mergedRoomIds,
                bindings.mergedKeepingThis(other.bindings(), mergedRoomIds));
    }

    public int endpointCount() {
        return bindings.doorBindings().size() + bindings.anchorRefs().size();
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null && roomId > 0L) {
                result.add(roomId);
            }
        }
        return List.copyOf(result);
    }
}
