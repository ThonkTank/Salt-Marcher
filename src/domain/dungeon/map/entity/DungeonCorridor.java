package src.domain.dungeon.map.entity;

import src.domain.dungeon.map.value.DungeonCorridorBindings;

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
        return roomIds.size() >= 2 || !bindings.waypoints().isEmpty();
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
