package src.domain.dungeon.model.runtime.travel.projection;

import org.jspecify.annotations.Nullable;

public record TravelTransitionTarget(
        TargetKind kind,
        long mapId,
        long tileId,
        long transitionId
) {
    private static final long NO_TRANSITION_ID = 0L;

    public TravelTransitionTarget {
        kind = kind == null ? TargetKind.DUNGEON_MAP : kind;
        mapId = Math.max(0L, mapId);
        tileId = kind.isOverworldTile() ? Math.max(0L, tileId) : 0L;
        transitionId = Math.max(NO_TRANSITION_ID, transitionId);
    }

    public static TravelTransitionTarget dungeonMap(long mapId, @Nullable Long transitionId) {
        return new TravelTransitionTarget(
                TargetKind.DUNGEON_MAP,
                mapId,
                NO_TRANSITION_ID,
                transitionId == null ? NO_TRANSITION_ID : transitionId);
    }

    public static TravelTransitionTarget overworldTile(long mapId, long tileId) {
        return new TravelTransitionTarget(TargetKind.OVERWORLD_TILE, mapId, tileId, NO_TRANSITION_ID);
    }

    public boolean isDungeonMapTarget() {
        return kind.isDungeonMap();
    }

    public boolean isOverworldTileTarget() {
        return kind.isOverworldTile();
    }

    public boolean hasTransitionId() {
        return transitionId > NO_TRANSITION_ID;
    }

    public enum TargetKind {
        DUNGEON_MAP,
        OVERWORLD_TILE;

        private boolean isDungeonMap() {
            return this == DUNGEON_MAP;
        }

        private boolean isOverworldTile() {
            return this == OVERWORLD_TILE;
        }
    }
}
