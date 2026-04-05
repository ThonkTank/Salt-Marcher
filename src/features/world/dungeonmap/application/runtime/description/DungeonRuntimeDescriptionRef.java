package features.world.dungeonmap.application.runtime.description;

import java.util.Objects;

public record DungeonRuntimeDescriptionRef(
        String kind,
        String id
) {
    public DungeonRuntimeDescriptionRef {
        kind = Objects.requireNonNull(kind, "kind").trim();
        id = Objects.requireNonNull(id, "id").trim();
        if (kind.isEmpty()) {
            throw new IllegalArgumentException("kind darf nicht leer sein");
        }
        if (id.isEmpty()) {
            throw new IllegalArgumentException("id darf nicht leer sein");
        }
    }

    public static DungeonRuntimeDescriptionRef room(long mapId, long roomId) {
        return new DungeonRuntimeDescriptionRef("room", mapId + ":" + roomId);
    }

    public static DungeonRuntimeDescriptionRef corridor(long mapId, long corridorId) {
        return new DungeonRuntimeDescriptionRef("corridor", mapId + ":" + corridorId);
    }

    public static DungeonRuntimeDescriptionRef stair(long mapId, long stairId) {
        return new DungeonRuntimeDescriptionRef("stair", mapId + ":" + stairId);
    }

    public static DungeonRuntimeDescriptionRef transition(long mapId, long transitionId) {
        return new DungeonRuntimeDescriptionRef("transition", mapId + ":" + transitionId);
    }
}
