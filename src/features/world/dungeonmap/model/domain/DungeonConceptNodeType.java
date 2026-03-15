package features.world.dungeonmap.model.domain;

public enum DungeonConceptNodeType {
    ENTRANCE("Eingang"),
    LEVEL_TRANSITION("Ebenenwechsel");

    private final String label;

    DungeonConceptNodeType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public String persistenceValue() {
        return switch (this) {
            case ENTRANCE -> "entrance";
            case LEVEL_TRANSITION -> "level_transition";
        };
    }

    public static DungeonConceptNodeType fromPersistenceValue(String value) {
        return switch (value == null ? "" : value) {
            case "entrance" -> ENTRANCE;
            case "level_transition" -> LEVEL_TRANSITION;
            default -> throw new IllegalArgumentException("Unknown concept node type: " + value);
        };
    }
}
