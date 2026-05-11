package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorRef;
import src.domain.dungeon.model.map.model.DungeonCorridorBindings;
import src.domain.dungeon.model.map.model.DungeonCorridorDoorBinding;

import java.util.ArrayList;
import java.util.List;

public final class DungeonCorridorOps {

    private DungeonCorridorOps() {
    }

    public static boolean isReadable(DungeonCorridor corridor) {
        return corridor != null && (endpointCount(corridor) >= 2 || !corridor.bindings().waypoints().isEmpty());
    }

    public static boolean connectsRoom(DungeonCorridor corridor, long roomId) {
        return corridor != null && roomId > 0L && corridor.roomIds().contains(roomId);
    }

    public static DungeonCorridor withAddedRoom(DungeonCorridor corridor, long roomId) {
        if (corridor == null || roomId <= 0L || corridor.roomIds().contains(roomId)) {
            return corridor;
        }
        List<Long> updated = new ArrayList<>(corridor.roomIds());
        updated.add(roomId);
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                updated,
                corridor.bindings().sanitizedForRooms(updated));
    }

    public static DungeonCorridor withoutRoom(DungeonCorridor corridor, long roomId) {
        if (corridor == null || roomId <= 0L || !corridor.roomIds().contains(roomId)) {
            return corridor;
        }
        List<Long> updated = corridor.roomIds().stream()
                .filter(existing -> existing != roomId)
                .toList();
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                updated,
                corridor.bindings().withoutDoorBinding(roomId));
    }

    public static DungeonCorridor withDoorBinding(DungeonCorridor corridor, DungeonCorridorDoorBinding binding) {
        if (corridor == null || binding == null) {
            return corridor;
        }
        DungeonCorridor updated = connectsRoom(corridor, binding.roomId()) ? corridor : withAddedRoom(corridor, binding.roomId());
        return new DungeonCorridor(
                updated.corridorId(),
                updated.mapId(),
                updated.level(),
                updated.roomIds(),
                updated.bindings().withDoorBinding(binding));
    }

    public static DungeonCorridor withAnchorBinding(DungeonCorridor corridor, DungeonCorridorAnchorBinding binding) {
        if (corridor == null || binding == null) {
            return corridor;
        }
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                corridor.roomIds(),
                corridor.bindings().withAnchorBinding(binding));
    }

    public static DungeonCorridor withAnchorRef(DungeonCorridor corridor, DungeonCorridorAnchorRef ref) {
        if (corridor == null || ref == null || !ref.present()) {
            return corridor;
        }
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                corridor.roomIds(),
                corridor.bindings().withAnchorRef(ref));
    }

    public static DungeonCorridor withBindings(DungeonCorridor corridor, DungeonCorridorBindings nextBindings) {
        if (corridor == null) {
            return null;
        }
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                corridor.roomIds(),
                nextBindings);
    }

    public static DungeonCorridor mergeKeepingThis(DungeonCorridor corridor, DungeonCorridor other) {
        if (corridor == null || other == null || corridor.equals(other)) {
            return corridor;
        }
        List<Long> mergedInput = new ArrayList<>(corridor.roomIds());
        mergedInput.addAll(other.roomIds());
        return new DungeonCorridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                mergedInput,
                corridor.bindings().mergedKeepingThis(other.bindings(), mergedInput));
    }

    public static int endpointCount(DungeonCorridor corridor) {
        return corridor == null
                ? 0
                : corridor.bindings().doorBindings().size() + corridor.bindings().anchorRefs().size();
    }
}
