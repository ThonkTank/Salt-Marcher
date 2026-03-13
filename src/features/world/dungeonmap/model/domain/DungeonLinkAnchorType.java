package features.world.dungeonmap.model.domain;

public enum DungeonLinkAnchorType {
    ENDPOINT("endpoint"),
    PASSAGE("passage");

    private final String dbValue;

    DungeonLinkAnchorType(String dbValue) {
        this.dbValue = dbValue;
    }

    public String dbValue() {
        return dbValue;
    }

    public int persistenceOrder() {
        return switch (this) {
            case ENDPOINT -> 0;
            case PASSAGE -> 1;
        };
    }

    public static DungeonLinkAnchorType fromDbValue(String value) {
        for (DungeonLinkAnchorType type : values()) {
            if (type.dbValue.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown dungeon link anchor type: " + value);
    }
}
