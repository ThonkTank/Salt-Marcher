package src.domain.dungeon.model.core.structure.transition;

import org.jspecify.annotations.Nullable;

public record TransitionDestination(
        TransitionDestinationType type,
        long mapId,
        long tileId,
        @Nullable Long transitionId
) {
    private static final String OVERWORLD_TILE_LABEL = "Overworld-Feld ";
    private static final String DUNGEON_LABEL = "Dungeon ";
    private static final String UNLINKED_ENTRANCE_LABEL = "Dungeon-Eingang (unverbunden)";
    private static final String TRANSITION_LABEL = " / Übergang ";

    public TransitionDestination {
        type = TransitionDestinationType.normalize(type);
        mapId = type.isUnlinkedEntrance() ? 0L : Math.max(0L, mapId);
        tileId = type.isOverworldTile() ? Math.max(0L, tileId) : 0L;
        transitionId = normalizedTransitionId(type, transitionId);
    }

    public static TransitionDestination dungeonMap(long mapId, @Nullable Long transitionId) {
        return new TransitionDestination(TransitionDestinationType.DUNGEON_MAP, mapId, 0L, transitionId);
    }

    public static TransitionDestination overworldTile(long mapId, long tileId) {
        return new TransitionDestination(TransitionDestinationType.OVERWORLD_TILE, mapId, tileId, null);
    }

    public static TransitionDestination unlinkedEntrance() {
        return new TransitionDestination(TransitionDestinationType.UNLINKED_ENTRANCE, 0L, 0L, null);
    }

    public boolean isDungeonMap() {
        return type.isDungeonMap();
    }

    public boolean isOverworldTile() {
        return type.isOverworldTile();
    }

    public boolean isUnlinkedEntrance() {
        return type.isUnlinkedEntrance();
    }

    public boolean isValid() {
        if (isUnlinkedEntrance()) {
            return true;
        }
        return isOverworldTile()
                ? mapId > 0L && tileId > 0L
                : isDungeonMap() && mapId > 0L;
    }

    public boolean referencesTransition(long candidateTransitionId) {
        return transitionId != null && transitionId == candidateTransitionId;
    }

    public String label() {
        if (isOverworldTile()) {
            return OVERWORLD_TILE_LABEL + tileId;
        }
        if (isDungeonMap()) {
            return transitionId == null
                    ? DUNGEON_LABEL + mapId
                    : DUNGEON_LABEL + mapId + TRANSITION_LABEL + transitionId;
        }
        if (isUnlinkedEntrance()) {
            return UNLINKED_ENTRANCE_LABEL;
        }
        return "";
    }

    private static @Nullable Long positiveTransitionId(@Nullable Long candidate) {
        if (candidate == null || candidate <= 0L) {
            return null;
        }
        return candidate;
    }

    private static @Nullable Long normalizedTransitionId(
            TransitionDestinationType type,
            @Nullable Long candidate
    ) {
        if (type.isUnlinkedEntrance()) {
            return null;
        }
        return positiveTransitionId(candidate);
    }
}
