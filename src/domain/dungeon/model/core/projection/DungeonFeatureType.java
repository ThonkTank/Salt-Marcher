package src.domain.dungeon.model.core.projection;

public enum DungeonFeatureType {
    STAIR,
    TRANSITION,
    OBJECT,
    ENCOUNTER,
    POI;

    public boolean isTransition() {
        return this == TRANSITION;
    }

    public boolean isMarker() {
        return this == OBJECT || this == ENCOUNTER || this == POI;
    }
}
