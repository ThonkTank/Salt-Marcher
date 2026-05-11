package src.domain.dungeon.model.map.model;

public final class DungeonFeatureType {
    public static final DungeonFeatureType STAIR = new DungeonFeatureType("STAIR");
    public static final DungeonFeatureType TRANSITION = new DungeonFeatureType("TRANSITION");

    private final String name;

    private DungeonFeatureType(String name) {
        this.name = name;
    }

    public static DungeonFeatureType valueOf(String name) {
        return "TRANSITION".equals(name) ? TRANSITION : STAIR;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
