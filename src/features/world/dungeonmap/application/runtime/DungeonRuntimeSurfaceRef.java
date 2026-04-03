package features.world.dungeonmap.application.runtime;

import java.util.Objects;

public record DungeonRuntimeSurfaceRef(
        String kind,
        String id
) {
    public DungeonRuntimeSurfaceRef {
        kind = Objects.requireNonNull(kind, "kind").trim();
        id = Objects.requireNonNull(id, "id").trim();
        if (kind.isEmpty()) {
            throw new IllegalArgumentException("kind darf nicht leer sein");
        }
        if (id.isEmpty()) {
            throw new IllegalArgumentException("id darf nicht leer sein");
        }
    }

    public static DungeonRuntimeSurfaceRef room(long mapId, long roomId) {
        return new DungeonRuntimeSurfaceRef("room", mapId + ":" + roomId);
    }

    public static DungeonRuntimeSurfaceRef corridor(long mapId, long corridorId) {
        return new DungeonRuntimeSurfaceRef("corridor", mapId + ":" + corridorId);
    }

    public static DungeonRuntimeSurfaceRef stair(long mapId, long stairId) {
        return new DungeonRuntimeSurfaceRef("stair", mapId + ":" + stairId);
    }

    public static DungeonRuntimeSurfaceRef transition(long mapId, long transitionId) {
        return new DungeonRuntimeSurfaceRef("transition", mapId + ":" + transitionId);
    }
}
