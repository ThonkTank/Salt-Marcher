package src.domain.dungeon.model.core.structure.transition;

import org.jspecify.annotations.Nullable;

public enum TransitionDestinationType {
    DUNGEON_MAP,
    OVERWORLD_TILE;

    public static TransitionDestinationType defaultType() {
        return DUNGEON_MAP;
    }

    public static TransitionDestinationType normalize(@Nullable TransitionDestinationType candidate) {
        return candidate == null ? defaultType() : candidate;
    }

    public boolean isDungeonMap() {
        return this == DUNGEON_MAP;
    }

    public boolean isOverworldTile() {
        return this == OVERWORLD_TILE;
    }
}
