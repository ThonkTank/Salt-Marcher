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
    private static final String TRANSITION_LABEL = " / Übergang ";

    public TransitionDestination {
        type = TransitionDestinationType.normalize(type);
        mapId = Math.max(0L, mapId);
        tileId = type.isOverworldTile() ? Math.max(0L, tileId) : 0L;
        transitionId = positiveTransitionId(transitionId);
    }

    public static TransitionDestination dungeonMap(long mapId, @Nullable Long transitionId) {
        return new TransitionDestination(TransitionDestinationType.DUNGEON_MAP, mapId, 0L, transitionId);
    }

    public static TransitionDestination overworldTile(long mapId, long tileId) {
        return new TransitionDestination(TransitionDestinationType.OVERWORLD_TILE, mapId, tileId, null);
    }

    public boolean isDungeonMap() {
        return type.isDungeonMap();
    }

    public boolean isOverworldTile() {
        return type.isOverworldTile();
    }

    public boolean isValid() {
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
        return "";
    }

    private static @Nullable Long positiveTransitionId(@Nullable Long candidate) {
        if (candidate == null || candidate <= 0L) {
            return null;
        }
        return candidate;
    }
}
