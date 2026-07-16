package features.dungeon.domain.core.structure.transition;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

public enum TransitionDestinationType {
    DUNGEON_MAP,
    OVERWORLD_TILE,
    UNLINKED_ENTRANCE;

    public static TransitionDestinationType defaultType() {
        return UNLINKED_ENTRANCE;
    }

    public static TransitionDestinationType normalize(@Nullable TransitionDestinationType candidate) {
        return candidate == null ? defaultType() : candidate;
    }

    public static TransitionDestinationType fromExternalName(@Nullable String value) {
        String normalized = value == null ? "" : value.strip().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return defaultType();
        }
        return valueOf(normalized);
    }

    public boolean isDungeonMap() {
        return this == DUNGEON_MAP;
    }

    public boolean isOverworldTile() {
        return this == OVERWORLD_TILE;
    }

    public boolean isUnlinkedEntrance() {
        return this == UNLINKED_ENTRANCE;
    }
}
