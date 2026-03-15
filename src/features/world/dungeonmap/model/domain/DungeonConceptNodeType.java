package features.world.dungeonmap.model.domain;

public enum DungeonConceptNodeType {
    ENTRANCE("Eingang"),
    EXIT("Ausgang"),
    LEVEL_TRANSITION("Ebenenwechsel"),
    ROOM("Raum");

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
            case EXIT -> "exit";
            case LEVEL_TRANSITION -> "level_transition";
            case ROOM -> "room";
        };
    }

    public static DungeonConceptNodeType fromPersistenceValue(String value) {
        return switch (value == null ? "" : value) {
            case "entrance" -> ENTRANCE;
            case "exit" -> EXIT;
            case "level_transition" -> LEVEL_TRANSITION;
            case "room" -> ROOM;
            default -> throw new IllegalArgumentException("Unknown concept node type: " + value);
        };
    }
}
