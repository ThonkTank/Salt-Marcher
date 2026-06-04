package src.domain.dungeon.model.core.projection;

public enum DungeonFeatureType {
    STAIR,
    TRANSITION;

    public boolean isTransition() {
        return this == TRANSITION;
    }
}
