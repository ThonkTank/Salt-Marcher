package src.domain.dungeon.model.worldspace;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;

public final class DungeonTransitionDestination {

    private final TransitionDestination coreDestination;

    private DungeonTransitionDestination(TransitionDestination coreDestination) {
        this.coreDestination = coreDestination == null
                ? TransitionDestination.dungeonMap(0L, null)
                : coreDestination;
    }

    public static DungeonTransitionDestination dungeonMapDestination(long mapId, @Nullable Long transitionId) {
        return new DungeonTransitionDestination(TransitionDestination.dungeonMap(mapId, transitionId));
    }

    public static DungeonTransitionDestination overworldTileDestination(long mapId, long tileId) {
        return new DungeonTransitionDestination(TransitionDestination.overworldTile(mapId, tileId));
    }

    public long mapId() {
        return coreDestination.mapId();
    }

    public long tileId() {
        return coreDestination.tileId();
    }

    public @Nullable Long transitionId() {
        return coreDestination.transitionId();
    }

    public boolean isDungeonMapDestination() {
        return coreDestination.isDungeonMap();
    }

    public boolean isOverworldTileDestination() {
        return coreDestination.isOverworldTile();
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonTransitionDestination that
                && coreDestination.equals(that.coreDestination);
    }

    @Override
    public int hashCode() {
        return Objects.hash(coreDestination);
    }

    TransitionDestination coreDestination() {
        return coreDestination;
    }

    static DungeonTransitionDestination fromCore(TransitionDestination coreDestination) {
        return new DungeonTransitionDestination(coreDestination);
    }
}
