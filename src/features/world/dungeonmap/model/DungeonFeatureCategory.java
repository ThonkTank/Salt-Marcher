package features.world.dungeonmap.model;

public enum DungeonFeatureCategory {
    HAZARD("hazard", "Gefahr"),
    ENCOUNTER("encounter", "Begegnung"),
    TREASURE("treasure", "Schatz"),
    CURIOSITY("curiosity", "Kuriosität");

    private final String dbValue;
    private final String label;

    DungeonFeatureCategory(String dbValue, String label) {
        this.dbValue = dbValue;
        this.label = label;
    }

    public String dbValue() {
        return dbValue;
    }

    public String label() {
        return label;
    }

    public static DungeonFeatureCategory fromDbValue(String dbValue) {
        if (dbValue == null || dbValue.isBlank()) {
            return CURIOSITY;
        }
        for (DungeonFeatureCategory category : values()) {
            if (category.dbValue.equalsIgnoreCase(dbValue)) {
                return category;
            }
        }
        return CURIOSITY;
    }

    @Override
    public String toString() {
        return label;
    }
}
