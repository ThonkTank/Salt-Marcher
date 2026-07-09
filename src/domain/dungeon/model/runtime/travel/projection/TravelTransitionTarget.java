package src.domain.dungeon.model.runtime.travel.projection;

import src.domain.dungeon.model.core.structure.transition.TransitionDestinationTarget;

public record TravelTransitionTarget(
        TargetKind kind,
        long mapId,
        long tileId,
        long transitionId
) {
    private static final long NO_TRANSITION_ID = 0L;

    public TravelTransitionTarget {
        kind = kind == null ? TargetKind.ABSENT : kind;
        mapId = kind.isAbsent() ? 0L : Math.max(0L, mapId);
        tileId = kind.isOverworldTile() ? Math.max(0L, tileId) : 0L;
        transitionId = kind.isDungeonMap() ? Math.max(NO_TRANSITION_ID, transitionId) : NO_TRANSITION_ID;
    }

    public static TravelTransitionTarget absent() {
        return new TravelTransitionTarget(TargetKind.ABSENT, 0L, 0L, NO_TRANSITION_ID);
    }

    public static TravelTransitionTarget dungeonMap(
            long mapId,
            TransitionDestinationTarget transitionTarget
    ) {
        return new TravelTransitionTarget(
                TargetKind.DUNGEON_MAP,
                mapId,
                NO_TRANSITION_ID,
                transitionTarget == null ? NO_TRANSITION_ID : transitionTarget.transitionId());
    }

    public static TravelTransitionTarget overworldTile(long mapId, long tileId) {
        return new TravelTransitionTarget(TargetKind.OVERWORLD_TILE, mapId, tileId, NO_TRANSITION_ID);
    }

    public boolean isDungeonMapTarget() {
        return kind.isDungeonMap();
    }

    public boolean isAbsent() {
        return kind.isAbsent();
    }

    public boolean isOverworldTileTarget() {
        return kind.isOverworldTile();
    }

    public boolean hasTransitionId() {
        return transitionId > NO_TRANSITION_ID;
    }

    public enum TargetKind {
        ABSENT,
        DUNGEON_MAP,
        OVERWORLD_TILE;

        private boolean isAbsent() {
            return this == ABSENT;
        }

        private boolean isDungeonMap() {
            return this == DUNGEON_MAP;
        }

        private boolean isOverworldTile() {
            return this == OVERWORLD_TILE;
        }
    }
}
