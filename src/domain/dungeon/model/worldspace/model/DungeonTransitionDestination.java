package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

public final class DungeonTransitionDestination {

    private final String typeKey;
    private final long mapId;
    private final long tileId;
    private final @Nullable Long transitionId;

    private DungeonTransitionDestination(
            String typeKey,
            long mapId,
            long tileId,
            @Nullable Long transitionId
    ) {
        this.typeKey = typeKey == null || typeKey.isBlank() ? "DUNGEON_MAP" : typeKey.trim();
        this.mapId = Math.max(0L, mapId);
        this.tileId = Math.max(0L, tileId);
        this.transitionId = transitionId == null || transitionId <= 0L ? null : transitionId;
    }

    public static DungeonTransitionDestination dungeonMapDestination(long mapId, @Nullable Long transitionId) {
        return new DungeonTransitionDestination("DUNGEON_MAP", mapId, 0L, transitionId);
    }

    public static DungeonTransitionDestination overworldTileDestination(long mapId, long tileId) {
        return new DungeonTransitionDestination("OVERWORLD_TILE", mapId, tileId, null);
    }

    public long mapId() {
        return mapId;
    }

    public long tileId() {
        return tileId;
    }

    public @Nullable Long transitionId() {
        return transitionId;
    }

    public boolean isDungeonMapDestination() {
        return "DUNGEON_MAP".equals(typeKey);
    }

    public boolean isOverworldTileDestination() {
        return "OVERWORLD_TILE".equals(typeKey);
    }
}
