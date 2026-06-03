package src.domain.dungeon.model.worldspace;

public final class DungeonFeatureType {
    public static final DungeonFeatureType STAIR = new DungeonFeatureType("STAIR");
    public static final DungeonFeatureType TRANSITION = new DungeonFeatureType("TRANSITION");

    private final String name;

    private DungeonFeatureType(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public boolean isTransition() {
        return this == TRANSITION;
    }

    @Override
    public String toString() {
        return name;
    }
}
