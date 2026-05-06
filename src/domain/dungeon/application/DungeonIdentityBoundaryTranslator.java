package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonMapId;

public final class DungeonIdentityBoundaryTranslator {

    private DungeonIdentityBoundaryTranslator() {
    }

    public static DungeonMapId id(@Nullable DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    public static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    public static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }
}
