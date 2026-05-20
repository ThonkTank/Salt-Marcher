package src.domain.dungeon.published;

public enum DungeonFeatureKind {
    STAIR,
    TRANSITION;

    public static DungeonFeatureKind fromName(String name) {
        return "TRANSITION".equals(name) ? TRANSITION : STAIR;
    }

    public boolean isTransition() {
        return this == TRANSITION;
    }
}
